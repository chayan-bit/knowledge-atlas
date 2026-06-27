atlasAdd({
  id: "lowlevel",
  topics: [
    {
      id: "ll-network",
      title: "Network programming & async I/O",
      level: "Advanced",
      body: [
        "BSD sockets, TCP internals (3-way handshake, sliding window, congestion control - Reno/CUBIC/BBR), **epoll** (edge vs level triggered), non-blocking I/O and the **C10K problem**, and the modern answer: **io_uring** (zero-copy async, submission/completion rings).",
        "Build an epoll echo server handling 10k+ connections - it's the foundation of every high-performance server you'll touch.",
      ],
      subtopics: [
        {
          title: "BSD sockets: the API from connect to close",
          body: [
            "The **BSD socket API** (1983, still the universal interface) abstracts network communication as file descriptors. Every socket is an fd; you read and write it like a file. The key calls: `socket(AF_INET, SOCK_STREAM, 0)` creates a TCP socket fd. `bind(fd, addr, addrlen)` assigns it a local address/port. `listen(fd, backlog)` puts a server socket into accepting mode with a queue of `backlog` pending connections. `accept(fd, ...)` dequeues one completed connection, returning a new fd for that connection. `connect(fd, addr, addrlen)` initiates a connection from the client side. `send`/`recv` (or `write`/`read`) transfer data. `close` closes the fd and tears down the connection.",
            "The `sockaddr_in` structure (IPv4) and `sockaddr_in6` (IPv6) hold the address. `getaddrinfo(hostname, port, ...)` resolves a hostname to addresses in a protocol-agnostic way, returning a linked list of `addrinfo` structs. Always use `getaddrinfo` rather than manual `inet_aton` / `htonl` calls - it handles IPv4/IPv6 transparently and does DNS resolution. `htonl`/`htons` (host-to-network long/short) convert integers to big-endian (network byte order); forget these and your port numbers will be backwards.",
            "Error handling in socket code is notoriously subtle. `send` can return fewer bytes than requested (partial write) - always loop until all bytes are sent. `recv` can return fewer bytes than expected (TCP is a byte stream, not a message protocol) - always frame your messages with a length prefix and reassemble. `EINTR` is returned when a system call is interrupted by a signal - always retry on `EINTR`. `EAGAIN`/`EWOULDBLOCK` from a non-blocking socket means no data is available right now - not an error, just retry when the socket is readable. These edge cases are the difference between a socket server that works in testing and one that works in production.",
            "The **TIME_WAIT** state is the most common source of confusion for server developers. After a TCP connection closes, the initiating side enters TIME_WAIT for 2 * MSL (Maximum Segment Lifetime, typically 2 minutes on Linux). This prevents stale packets from an old connection being confused with a new connection on the same port. A busy server that closes many connections will accumulate thousands of TIME_WAIT sockets (visible in `ss -s` or `netstat -s`). The fix is `SO_REUSEADDR` (allows binding to a port with TIME_WAIT sockets), not `SO_LINGER` with zero timeout (which causes abrupt RST-based close, breaking the other end's receive buffer). For servers, always set `SO_REUSEADDR` before `bind`.",
          ],
          resources: [
            { label: "Beej's Guide to Network Programming (free, the canonical C socket tutorial)", url: "https://beej.us/guide/bgnet/", type: "book" },
            { label: "man 7 socket - Linux socket API overview", url: "https://man7.org/linux/man-pages/man7/socket.7.html", type: "docs" },
          ],
        },
        {
          title: "TCP internals: 3-way handshake, flow control, and congestion control",
          body: [
            "TCP's **3-way handshake** establishes a connection with reliable sequence number synchronization. Client sends SYN (with its initial sequence number ISN_c). Server responds SYN-ACK (with its ISN_s and ACKing ISN_c+1). Client responds ACK (ACKing ISN_s+1). The connection is now established; both sides have agreed on sequence numbers for reliable ordering and retransmission. The server's `listen` queue actually has two parts: the **SYN queue** (half-open connections that have sent SYN-ACK but not received ACK) and the **accept queue** (fully established connections waiting to be accept()ed). A SYN flood attack fills the SYN queue, preventing legitimate connections; `tcp_syncookies` (`sysctl net.ipv4.tcp_syncookies=1`) mitigates this by encoding the SYN-ACK sequence number with a hash that avoids storing SYN queue state.",
            "**Flow control** prevents the sender from overwhelming a slow receiver. The receiver advertises its **receive window** (rwnd) - the available space in its receive buffer - in every ACK. The sender must not have more than rwnd bytes of unacknowledged data outstanding at any time. The receive buffer size is tunable (`SO_RCVBUF`); Linux also auto-tunes it (`net.ipv4.tcp_rmem`). A receive window of zero causes the sender to stop sending and probe periodically; this happens when the application is not reading fast enough (a slow `recv` loop causes flow-control backpressure all the way to the sender).",
            "**Congestion control** prevents the sender from overwhelming the network. The sender maintains a **congestion window** (cwnd) in addition to rwnd; the effective window is `min(cwnd, rwnd)`. TCP Reno/Tahoe use **AIMD (Additive Increase, Multiplicative Decrease)**: during slow start, cwnd doubles per RTT; on congestion (packet loss), halve cwnd. **CUBIC** (Linux default since 2.6.19) grows cwnd as a cubic function of time since last congestion event, recovering faster after the halving on high-BDP links. **BBR (Bottleneck Bandwidth and RTT)** is Google's algorithm (2016): instead of reacting to packet loss, it models the network's BDP (bandwidth-delay product) and directly targets the bottleneck bandwidth and RTT. BBR achieves higher throughput on lossy links (satellite, cellular) and lower queuing delay. YouTube and Gmail migrated to BBR and saw 4-14% throughput improvement globally.",
            "**Nagle's algorithm** coalesces small writes into larger segments, waiting up to 200ms for more data if there is unacknowledged data in flight. This is catastrophic for interactive protocols (SSH, Redis, game clients) where you write a small request and immediately want it sent. Disable with `TCP_NODELAY`: `setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &one, sizeof(one))`. Conversely, `TCP_CORK` holds data until the application signals it is done building a logical message (`TCP_UNCORK`) or until the buffer is full - used by HTTP servers to batch header + body into one segment.",
          ],
          resources: [
            { label: "TCP/IP Illustrated Vol. 1 - Stevens (the definitive reference)", url: "https://www.amazon.com/TCP-Illustrated-Vol-Addison-Wesley-Professional/dp/0201633469", type: "book" },
            { label: "BBR paper - Congestion-Based Congestion Control (CACM 2017)", url: "https://dl.acm.org/doi/10.1145/3009824", type: "paper" },
          ],
        },
        {
          title: "Non-blocking I/O and epoll: the C10K architecture",
          body: [
            "The **C10K problem** (Kegel, 1999) asked: how do you handle 10,000 simultaneous connections on a single server? The naive approach - one thread per connection - fails because threads are expensive (1-8 MB stack each, context switch overhead, scheduler pressure). 10,000 threads would consume 10-80 GB of memory and spend most of their time blocked waiting for I/O, accomplishing nothing useful. The solution is **non-blocking I/O** with **I/O multiplexing**: a small, fixed number of threads serve all connections by waiting for events on all file descriptors simultaneously.",
            "In **non-blocking mode** (`fcntl(fd, F_SETFL, O_NONBLOCK)`), `recv` and `send` return immediately: if no data is available, they return -1 with `errno = EAGAIN` instead of blocking. `connect` in non-blocking mode returns immediately with `EINPROGRESS` and completes asynchronously. The application must then ask the OS 'which fds are ready?' using an I/O multiplexer.",
            "**`select`** (original POSIX, 1983) takes three fd_sets (read-ready, write-ready, error) and a timeout, and returns which fds are ready. It works but scales poorly: the fd_set is limited to FD_SETSIZE (usually 1024) file descriptors, and the kernel must scan the entire set on each call. `poll` removes the 1024 fd limit but still scales $O(n)$ in the number of fds. Neither is practical for C10K.",
            "**`epoll`** (Linux 2.6+) is $O(1)$ in the number of ready events, not $O(n)$ in the number of monitored fds. You create an epoll instance (`epoll_create`), add fds to monitor (`epoll_ctl(epfd, EPOLL_CTL_ADD, fd, &event)`), and wait for events (`epoll_wait(epfd, events, maxevents, timeout)`). The kernel maintains a red-black tree of monitored fds and a linked list of ready fds; `epoll_wait` returns only the ready ones. **Level-triggered (LT)** mode: continues reporting a fd as ready until all data is consumed - simple but may busy-loop if you do not drain the fd. **Edge-triggered (ET)** mode: reports a fd as ready only when its state changes (new data arrives) - requires non-blocking I/O and draining fully in a loop, but avoids redundant wakeups. Most high-performance servers use ET mode. A canonical epoll echo server with 10k+ connections runs on a single thread and saturates a gigabit NIC.",
          ],
          resources: [
            { label: "The C10K problem - Kegel (original 1999 article)", url: "http://www.kegel.com/c10k.html", type: "docs" },
            { label: "man 7 epoll - complete epoll reference", url: "https://man7.org/linux/man-pages/man7/epoll.7.html", type: "docs" },
          ],
        },
        {
          title: "io_uring: zero-copy async I/O and submission rings",
          body: [
            "**`io_uring`** (Jens Axboe, 2019, Linux 5.1+) is the modern async I/O interface that eliminates the overhead of `epoll` + non-blocking syscalls by batching I/O operations and avoiding context switches entirely. It is the biggest I/O subsystem redesign in Linux in 20 years, and it is already the default I/O engine in databases (RocksDB, io_uring backend), runtimes (liburing, tokio), and servers (nginx experimental, QEMU).",
            "The core mechanism: two **ring buffers** in memory shared between the kernel and userspace. The **submission queue (SQ)** is where the application writes I/O requests (read, write, accept, connect, send, recv, and more). The **completion queue (CQ)** is where the kernel writes results. `io_uring_enter()` submits the queued requests to the kernel - or, in **polling mode** (`IORING_SETUP_SQPOLL`), a kernel thread polls the SQ continuously, eliminating even the `io_uring_enter` syscall entirely. The application can submit many requests in one batch, dramatically reducing syscall overhead for high-throughput workloads.",
            "**Registered buffers and fixed files** are io_uring optimizations for zero-copy and reduced overhead. `io_uring_register(IORING_REGISTER_BUFFERS, ...)` pre-registers a set of buffers with the kernel, allowing subsequent I/O operations to reference them by index rather than performing per-operation page table lookups. `IORING_REGISTER_FILES` does the same for file descriptors. These registrations amortize the kernel's internal bookkeeping across many operations. Registered I/O with fixed buffers is the recommended path for maximum throughput in a storage or networking server.",
            "**Linked operations** allow you to chain multiple I/O operations with `IOSQE_IO_LINK`: operation N+1 starts only after operation N completes. This enables: `open -> read -> process -> write -> close` as a fully async pipeline submitted in one batch, without re-entering the syscall path for each step. Combined with `IORING_OP_SPLICE` (zero-copy data movement between fds) and `IORING_OP_SEND_ZC` (zero-copy send, Linux 6.0+), io_uring approaches true zero-copy networking with no data ever touching userspace.",
            "Comparison to epoll: epoll tells you *when* a fd is ready; you then make the actual I/O syscall. Two round-trips between user and kernel per operation. io_uring submits the I/O operation directly and gets the result asynchronously - one round-trip, and in polling mode, zero. For a file server doing 1M reads/sec, epoll requires 2M syscalls; io_uring with batching may require zero. Real benchmarks show 2-3x throughput improvement for storage workloads and significant latency reductions for network workloads with short connections.",
          ],
          resources: [
            { label: "Lord of the io_uring - comprehensive io_uring guide", url: "https://unixism.net/loti/", type: "docs" },
            { label: "io_uring - efficient I/O with io_uring (Axboe, PDF)", url: "https://kernel.dk/io_uring.pdf", type: "paper" },
          ],
        },
      ],
      resources: [
        { label: "Beej's Guide to Network Programming (free)", url: "https://beej.us/guide/bgnet/", type: "book" },
        { label: "io_uring - 'Lord of the io_uring' guide", url: "https://unixism.net/loti/", type: "docs" },
        { label: "The C10K problem (classic)", url: "http://www.kegel.com/c10k.html", type: "docs" },
      ],
      connections: [
        { to: "os-foundations", note: "Sockets are file descriptors; this is the OS I/O model in anger" },
        { to: "web-backend", note: "Node's event loop and high-throughput servers are built on epoll/io_uring" },
        { to: "quant-hft", note: "Kernel-bypass market-data feeds start from understanding TCP/epoll limits" },
      ],
    },
  ],
});
