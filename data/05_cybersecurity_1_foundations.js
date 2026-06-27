atlasAdd({
  id: "cyber",
  topics: [
    {
      id: "cyber-foundations",
      title: "Networking, TLS & Linux foundations",
      level: "Beginner",
      body: [
        "The non-negotiable base: the **CIA triad** and threat modeling (STRIDE), the OSI/TCP-IP stack (what each layer *does*), the TCP state machine, DNS, HTTP/HTTPS, **TLS** (cert chains, handshake, pinning), and Linux permission internals (`setuid`/`setgid`, `/etc/shadow`).",
        "Tooling fluency: `nmap`, Wireshark, Burp Suite. Capture and dissect a real TLS handshake to make it concrete.",
      ],
      subtopics: [
        {
          title: "CIA Triad and STRIDE Threat Modeling",
          body: [
            "Every security decision traces back to three properties: **Confidentiality** (only authorized parties read the data), **Integrity** (data is not altered in transit or at rest without detection), and **Availability** (the system remains accessible when needed). These are not independent - strong encryption protecting confidentiality can become an availability attack vector if key management fails, and a system with perfect integrity but constant downtime fails its users as surely as a data breach.",
            "**STRIDE** is Microsoft's systematic threat enumeration framework: **S**poofing identity (impersonating a user or service), **T**ampering with data (modifying data or code in transit or at rest), **R**epudiation (performing actions that can be later denied), **I**nformation disclosure (exposing data to unauthorized parties), **D**enial of service (making a system unavailable), and **E**levation of privilege (gaining capabilities beyond what's authorized). Apply STRIDE per-component by drawing a data flow diagram, identifying trust boundaries, and asking 'which STRIDE threat applies here?' for every data flow that crosses a boundary.",
            "**Attack trees** complement STRIDE by modeling attacker goals recursively: the root is the goal (e.g., 'steal user credentials'), child nodes are sub-goals, leaves are atomic attacker actions. This exposes the cheapest path an adversary takes. A web app storing passwords in plaintext has its 'steal credentials' leaf cost near zero; proper bcrypt hashing raises the leaf cost by orders of magnitude.",
            "**Risk = Likelihood × Impact**. CVSS (Common Vulnerability Scoring System) quantifies impact across attack vector, complexity, privileges required, user interaction, scope, and CIA impact. A CVSS 9.8 is a network-exploitable, low-complexity, no-authentication, high-impact flaw - these are the ones that become immediate 0-day exploits when published.",
            "Real incident: the 2017 Equifax breach was a STRIDE Spoofing + Information Disclosure failure - an Apache Struts OGNL injection (CVE-2017-5638) let attackers impersonate application context and exfiltrate 147 million records. The root cause was a failed patch process: the vulnerability was public for two months before exploitation. Threat modeling at the 'internet-facing web tier' node would have flagged injection as the highest-priority data-flow threat.",
          ],
          resources: [
            { label: "STRIDE Threat Modeling - Microsoft Docs", url: "https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats", type: "docs" },
            { label: "CVSS v3.1 Specification", url: "https://www.first.org/cvss/v3-1/cvss-v31-specification_r1.pdf", type: "paper" },
          ],
        },
        {
          title: "TCP/IP Stack and the TCP State Machine",
          body: [
            "The four-layer TCP/IP model (Link, Internet, Transport, Application) is the lens through which every network attack is understood. An attacker at the Link layer (ARP spoofing) poisons the MAC-to-IP mapping cache to intercept traffic before encryption can help. At the Internet layer (IP), source address spoofing enables amplification DDoS. At Transport (TCP/UDP), SYN flood attacks exploit the half-open connection queue. At Application, SQL injection and XSS are protocol-layer attacks that bypass the lower layers entirely.",
            "The **TCP three-way handshake** (SYN → SYN-ACK → ACK) creates connection state in the server's SYN backlog. A **SYN flood** sends thousands of SYN packets from spoofed IPs; the server allocates a `tcp_syncookies`-less slot for each, exhausting memory. The mitigation - **SYN cookies** - encodes connection state into the sequence number itself so no memory is allocated until the third ACK arrives, mathematically binding the cookie to the source IP, port, and timestamp.",
            "**TCP sequence number prediction** was historically a critical attack: if an attacker can predict the ISN (initial sequence number), they can inject data into an existing TCP stream without seeing it (blind injection). RFC 6528 mandates cryptographically random ISNs, defeating this. **TCP session hijacking** still works on unencrypted protocols by sniffing the current sequence number and injecting forged packets - which is why Telnet and FTP are categorically replaced by SSH and SFTP.",
            "Port scanning with `nmap` probes the TCP state machine: **SYN scan** (`-sS`) sends SYN and interprets SYN-ACK (open), RST (closed), or silence/ICMP unreachable (filtered) without completing the handshake, leaving no entry in the server's connection table. **Connect scan** (`-sT`) completes the handshake and is always logged. **UDP scan** (`-sU`) is slower because closed UDP ports respond with ICMP port-unreachable but open ports are often silent.",
            "Wireshark dissects at every layer simultaneously. For a TLS session: Frame → Ethernet II → IPv4 → TCP → TLS. The TCP stream view reconstructs the byte stream from potentially reordered/retransmitted packets. `tcp.analysis.retransmission` filters expose packet loss. `tls` filter shows Client Hello/Server Hello in plaintext even on encrypted sessions, revealing cipher suite negotiation, SNI (Server Name Indication), and certificate metadata.",
          ],
          resources: [
            { label: "nmap Reference Guide", url: "https://nmap.org/book/man.html", type: "docs" },
            { label: "TCP SYN Cookies - RFC 4987", url: "https://datatracker.ietf.org/doc/html/rfc4987", type: "docs" },
          ],
        },
        {
          title: "DNS Internals and Attacks",
          body: [
            "DNS is a hierarchical, distributed database mapping names to records. A resolver query for `www.example.com` traverses: Root nameservers (13 anycast clusters) → `.com` TLD nameservers → `example.com` authoritative nameservers. The resolver caches responses per TTL (Time-To-Live), creating a window for cache poisoning. The entire chain is unauthenticated in plain DNS - every hop is a forgery opportunity.",
            "**DNS cache poisoning** (Kaminsky attack, 2008): an attacker races to answer a resolver's query for a random subdomain of a target domain, injecting a forged response that also poisons the authoritative NS record for the entire domain. The amplification: one cache poisoning affects all users of that resolver. Kaminsky's insight was to avoid the birthday-paradox collision problem by querying a different random subdomain each time. The fix was randomizing the source UDP port (source port entropy doubles the search space from 65,536 to 4 billion), and ultimately **DNSSEC**.",
            "**DNSSEC** adds digital signatures (RSA or ECDSA) over DNS records. The `RRSIG` record signs the `A`/`MX`/etc. records; `DNSKEY` holds the public key; `DS` (Delegation Signer) in the parent zone chains trust upward to the root. A validating resolver walks this chain to the IANA root key. The limitation: DNSSEC prevents forgery but not eavesdropping - DNS queries still leak in plaintext. **DNS-over-HTTPS** (DoH) and **DNS-over-TLS** (DoT) encrypt the query itself.",
            "**DNS rebinding** exploits the Same-Origin Policy: an attacker controls a domain with a short TTL. The victim's browser visits attacker.com, which resolves to the attacker's server. The attacker's JS runs. Before TTL expires, the attacker changes the DNS record to `127.0.0.1`. On the next fetch, the browser re-resolves but considers the origin unchanged, so SOP allows the JS to now make requests to `localhost:8080` on the victim's machine - bypassing firewall rules that block external access to internal services.",
            "Practical recon: `nslookup`, `dig` (preferred), and `host`. `dig +trace example.com` walks the full delegation chain. Zone transfer (`dig AXFR @nameserver domain`) - if misconfigured - dumps all DNS records, exposing internal hostnames. **Subdomain enumeration** via wordlist (`amass`, `subfinder`) or brute-force DNS (`massdns`) finds non-public subdomains that are often less hardened.",
          ],
          resources: [
            { label: "Kaminsky DNS Vulnerability Paper", url: "https://www.cs.columbia.edu/~smb/papers/dnssec2.pdf", type: "paper" },
            { label: "DNSSEC: DNS Security Extensions - IANA", url: "https://www.iana.org/dnssec", type: "docs" },
          ],
        },
        {
          title: "TLS 1.3 Handshake and Certificate Chains",
          body: [
            "TLS 1.3 (RFC 8446) eliminates the 2-RTT negotiation of TLS 1.2. The client sends `ClientHello` with supported cipher suites and a **key share** (ephemeral DH/ECDH public key) in round 1. The server responds with its own key share, the chosen cipher suite, and immediately begins sending encrypted records. The shared secret is derived via HKDF from the DH exchange before the server even authenticates. Application data flows after just 1 RTT, and with **0-RTT resumption**, the client can replay early data on the first flight.",
            "The TLS 1.3 key schedule uses **HKDF** (HMAC-based Key Derivation Function) across three phases: Early Secret (from optional pre-shared key), Handshake Secret (from DH exchange), and Master Secret. Each phase derives two symmetric keys (client-write and server-write) and their IVs. The derivation uses 'context labels' (ASCII strings baked into the protocol) to ensure keys derived for different purposes are independent even if the underlying secret is shared.",
            "**Certificate chains**: a TLS certificate is an X.509 structure signed by a CA (Certificate Authority). The browser trusts a hard-coded set of Root CAs (stored in the OS or browser CA store). The server sends its leaf certificate plus any intermediate CA certificates. The browser verifies: (1) signature chain up to a trusted root, (2) certificate not revoked (OCSP/CRL), (3) `CN` or `SAN` field matches the hostname, (4) certificate not expired. A failure at any step produces the browser's 'Your connection is not private' error.",
            "**Certificate Transparency** (CT, RFC 6962) mandates that all publicly-trusted certificates are logged to public, append-only logs. Browsers reject certificates not present in at least two independent CT logs. This enables post-hoc auditing: anyone can scan the logs for mis-issued certificates. `crt.sh` is a public CT log search engine that frequently surfaces forgotten subdomains of a target during recon.",
            "Historical attacks on TLS form a catalog of how not to design a protocol: **BEAST** (2011) exploited CBC IV predictability in TLS 1.0; **POODLE** (2014) exploited SSL 3.0 CBC padding; **HEARTBLEED** (2014) exploited an OpenSSL buffer over-read in the heartbeat extension exposing up to 64KB of server memory per request, leaking private keys; **DROWN** (2016) exploited SSLv2 oracle in servers sharing keys with TLS. TLS 1.3 eliminated all these by dropping CBC, RSA key exchange, and all protocol versions before 1.3.",
          ],
          resources: [
            { label: "The Illustrated TLS 1.3 Connection", url: "https://tls13.xargs.org/", type: "docs" },
            { label: "RFC 8446 - TLS 1.3", url: "https://datatracker.ietf.org/doc/html/rfc8446", type: "docs" },
          ],
        },
        {
          title: "Linux Permission Model and Privilege Internals",
          body: [
            "Linux file permissions are a 12-bit mask: 3 bits each for user/group/other (read/write/execute) plus **setuid**, **setgid**, and **sticky** bits. `ls -l` shows `-rwsr-xr-x` where 's' in user-execute position means setuid. When a setuid binary executes, the effective UID (EUID) becomes the file owner's UID, not the calling user's UID. This is how `sudo` works: `sudo` is owned by root with the setuid bit, so calling it escalates EUID to 0.",
            "The credential structure in the kernel (`struct cred`) stores real UID (RUID - who you are), effective UID (EUID - what you can do), saved UID (SUID - for privilege dropping), and filesystem UID (FSUID). A process can drop privileges by calling `seteuid(getuid())`, setting EUID to RUID. A privilege escalation exploit typically targets overwriting this structure to set all fields to 0 (root) - which is exactly what `commit_creds(prepare_kernel_cred(0))` does at the kernel level.",
            "`/etc/shadow` stores password hashes in the format `$algorithm$salt$hash` - e.g., `$6$` is SHA-512 crypt. The salt is random per-user and prevents precomputed rainbow table attacks. Only root can read `/etc/shadow` (mode 640, owned root:shadow). Historically `/etc/passwd` stored hashes (world-readable), enabling offline cracking with period hardware - the shadow password system was introduced to separate the hash from the world-readable user metadata.",
            "**Linux capabilities** split root's omnipotence into discrete units: `CAP_NET_RAW` (raw socket creation, needed for `ping`), `CAP_DAC_OVERRIDE` (bypass file permission checks), `CAP_SYS_PTRACE` (trace arbitrary processes), `CAP_SYS_ADMIN` (almost everything - the de facto root). Containers typically drop most capabilities; a container escape often exploits one that was incorrectly retained. `capsh --print` lists current capabilities.",
            "The **`/proc` filesystem** is a window into kernel state. `/proc/PID/maps` shows memory layout (essential for exploit development - tells you where the stack, heap, and libraries are loaded). `/proc/PID/mem` is readable if you have `CAP_SYS_PTRACE`, enabling direct memory reading/writing of another process. `/proc/sys/kernel/randomize_va_space` (0/1/2) controls ASLR. `/proc/sys/kernel/dmesg_restrict` controls whether `dmesg` is accessible to unprivileged users - kernel addresses in `dmesg` defeat KASLR.",
          ],
          resources: [
            { label: "Linux Privilege Escalation - HackTricks", url: "https://book.hacktricks.xyz/linux-hardening/privilege-escalation", type: "docs" },
            { label: "Linux Capabilities Man Page", url: "https://man7.org/linux/man-pages/man7/capabilities.7.html", type: "docs" },
          ],
        },
        {
          title: "Essential Security Tooling: nmap, Wireshark, Burp Suite",
          body: [
            "**nmap** is the canonical network mapper. A typical engagement starts with `nmap -sn 192.168.1.0/24` (host discovery, no port scan), then `nmap -sV -sC -O -p- -T4 <target>` (service version detection, default scripts, OS detection, all 65535 ports). `-sV` sends protocol-specific probes to determine exact versions (Apache 2.4.51 vs 2.4.52). `-sC` runs NSE (Nmap Scripting Engine) default scripts - these detect vulnerabilities, enumerate SMB shares, test for anonymous FTP login. Output as XML (`-oX`) for import into Metasploit.",
            "The **NSE** (Nmap Scripting Engine) is Lua-based and ships with 600+ scripts in categories: `auth`, `broadcast`, `brute`, `discovery`, `exploit`, `vuln`. `nmap --script vuln <target>` runs all vulnerability scripts - it will test for EternalBlue (MS17-010), heartbleed, and dozens more. `nmap --script smb-enum-shares -p 445 <target>` lists SMB shares without credentials. Understanding what each script does before running it is critical for authorized engagements.",
            "**Wireshark** captures at the pcap level. Key filters: `http.request.method == \"POST\"` (catch form submissions, often containing credentials), `ftp` (FTP in cleartext), `dns` (every lookup the machine makes - reveals C2 beaconing patterns), `tcp.flags.syn==1 && tcp.flags.ack==0` (SYN packets only, reveals active port scans against you). The 'Follow TCP Stream' feature reconstructs the full conversation from segmented packets, making HTTP sessions readable.",
            "**Burp Suite** sits as an HTTP proxy between browser and server. The Proxy tab intercepts every request for inspection and modification. **Repeater** replays individual requests with modifications - the primary tool for manual injection testing. **Intruder** runs automated payload injection (fuzzing parameter values, credential stuffing). **Scanner** (Pro) runs automated vulnerability detection. The key workflow: browse the application normally with the proxy on, review the sitemap built from all observed requests, then Repeater-test each interesting endpoint for injection.",
            "A full recon workflow combines these: nmap discovers open ports and services, Wireshark monitors traffic during active testing (or passively on a shared network), Burp intercepts application-layer traffic. Supplement with `gobuster`/`ffuf` for directory brute-forcing (discovering hidden paths), `nikto` for server misconfiguration scanning (directory listing, default credentials, outdated server headers), and `sqlmap` for automated SQL injection after Burp confirms the injection point exists.",
          ],
          resources: [
            { label: "Nmap Network Scanning (book)", url: "https://nmap.org/book/", type: "book" },
            { label: "Burp Suite Web Security Academy", url: "https://portswigger.net/web-security", type: "course" },
            { label: "Wireshark User Guide", url: "https://www.wireshark.org/docs/wsug_html_chunked/", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "PortSwigger Web Security Academy", url: "https://portswigger.net/web-security", type: "course" },
        { label: "HackTricks Book", url: "https://book.hacktricks.xyz/", type: "docs" },
        { label: "pwn.college - Foundations", url: "https://pwn.college/", type: "course" },
      ],
      connections: [
        { to: "crypto-tls", note: "TLS handshake and certificate chain trust model" },
        { to: "ll-network", note: "TCP/IP stack implementation and socket internals" },
        { to: "os-process", note: "Linux process credentials and privilege internals" },
      ],
    },
  ],
});
