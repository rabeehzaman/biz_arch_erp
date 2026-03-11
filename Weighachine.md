# Combined Technical Report  
## CityPos CP-LWS201-BLA Weighing Scale Communication Protocol  
**Unified report compiled from three separate source reports**

---

## Document Purpose

This document combines and preserves the full content of three separate reports related to the **CityPos CP-LWS201-BLA** weighing scale and its communication protocol.

### Source Reports
1. **Architectural Analysis and Protocol Reverse-Engineering of the CityPos CP-LWS201-BLA Retail Weighing Scale**  
   *(from the uploaded `.docx` report)*

2. **Technical Documentation: CityPos CP-LWS201-BLA (Rongta RLS1000 OEM)**  
   *(from the uploaded technical `.md` report)*

3. **Direct Ethernet Integration Research for the CityPos CP-LWS201-BLA Label Scale**  
   *(from the uploaded deep-research `.md` report)*

### Objective
The goal of this combined report is to:

- preserve **all information** from the three reports,
- identify **common conclusions**,
- highlight **differences and contradictions**,
- produce one consolidated technical reference for implementation and testing.

No information has been intentionally removed.  
Where the reports disagree, the disagreement is clearly preserved.

---

# 1. Executive Summary

All three reports examine how to integrate the **CityPos CP-LWS201-BLA** barcode label weighing scale with a custom application, especially a **Node.js / Electron / POS / ERP** system, over **Ethernet/TCP-IP**.

The reports broadly agree that:

- the device is a **retail barcode label weighing scale**,
- **Ethernet/TCP-IP communication** is supported,
- the protocol appears to use a **packet-based structure**,
- a **start/handshake step** is likely required,
- **PLU write/update operations** are central,
- the device likely belongs to a **rebranded OEM ecosystem** rather than a uniquely documented CityPos-native protocol family.

However, there are major differences in:

- the **suspected OEM family**,
- the **default TCP port**,
- whether framing is **ASCII-style** or **binary-style**,
- the exact **read/upload command behavior**.

The combined conclusion is that **direct TCP integration is highly plausible**, but live testing is still required to confirm the exact protocol variant used by the physical device.

---

# 2. High-Level Findings Shared Across All Three Reports

## 2.1 Device Category
All three reports describe the device as a:

- barcode label printing weighing scale,
- retail labeling scale,
- Ethernet-capable scale intended for POS/ERP-style product synchronization.

## 2.2 Integration Goal
All reports support the same overall objective:

- direct communication from software to scale,
- reduced dependence on legacy vendor middleware,
- programmatic PLU management,
- better integration into modern desktop/web application architecture.

## 2.3 Communication Style
All three reports indicate a protocol structure involving:

- packet length,
- command code,
- payload/data section.

## 2.4 Session Start / Handshake
All three reports refer to a start/init step before further communication, most strongly centered around a command similar to:

`0201`

## 2.5 PLU-Oriented Workflow
All three reports treat PLU/product synchronization as a main workflow, including:

- product name,
- price,
- barcode format,
- department,
- weight-related information,
- shelf-life or expiry-related fields.

---

# 3. Major Areas of Agreement

## 3.1 Ethernet and TCP/IP Are Central
Every report assumes that the desired integration path is through **direct network communication** over Ethernet.

## 3.2 The Protocol Is Structured
All reports imply or state that messages are not free-form text but structured packets with fields such as:

- length,
- command,
- payload.

## 3.3 `0201` Is the Strongest Shared Start Command Candidate
The most consistent overlap between the reports is the use of a start/handshake packet resembling:

`00080201`

This is one of the strongest common points across all three sources.

## 3.4 `0110` Is the Strongest Shared PLU Write Candidate
The strongest shared candidate for uploading or updating PLUs is command:

`0110`

This is supported in all three reports, though the degree of certainty differs.

## 3.5 Fixed-Width Fields Matter
All three reports, either directly or indirectly, support the idea that product data is sent in fixed-width fields, especially for PLU data.

## 3.6 Live Validation Is Still Needed
Even the most confident reports still imply that true confirmation requires:

- live device testing,
- packet capture,
- actual socket response verification.

---

# 4. Major Differences Between the Reports

---

## 4.1 OEM Family Identification

### Report 1
States that the CityPos CP-LWS201-BLA is effectively aligned with the **Rongta RLS1000 / RLS1100C** family.

### Report 2
Also identifies the device as a **Rongta RLS1000 / RLS1100 OEM** unit.

### Report 3
Disagrees with the above certainty and instead suggests the device may be more closely aligned with the **ACLAS / Top / Pinnacle / 顶尖** ecosystem, while explicitly saying this is high-confidence but not fully proven.

### Combined Interpretation
There is no complete agreement on OEM lineage.

### Safe Consolidated Conclusion
The device is very likely a **rebranded OEM scale**, but the exact family remains unresolved between:

- **Rongta RLS1000 / RLS1100-type lineage**, and
- **ACLAS / Top / Pinnacle / 顶尖-type lineage**.

Final proof should come from:

- packet captures,
- device configuration interface,
- firmware identifiers,
- accepted command patterns,
- associated vendor utility behavior.

---

## 4.2 Default TCP Port

### Report 1
Primary candidate:

- `4000`

Fallbacks:

- `5000`
- `7778`

### Report 2
Default stated as:

- `5001`

### Report 3
Best public-ecosystem guess:

- `5002`

Fallback:

- `5001`

### Combined Interpretation
There is a direct conflict between the reports.

### Safe Consolidated Testing Order
A sensible merged test order is:

1. `5002`
2. `5001`
3. `4000`
4. `5000`
5. `7778`

This is a **test plan**, not proof.

---

## 4.3 Message Framing and Encoding Style

### Report 1
Strongly suggests **ASCII-encoded hex string framing**, meaning packets may be transmitted as ASCII characters representing hex digits.

Example:

`00080201`

### Report 2
Describes the protocol as **Binary / Hex Payload**, which leaves ambiguity as to whether examples are raw bytes or just displayed in hex notation.

### Report 3
Leans toward **ASCII-framed protocol conventions** in the broader host-software ecosystem, but says direct device-level confirmation is still needed.

### Combined Interpretation
The combined evidence leans toward ASCII-like framing being plausible, but binary framing cannot be ruled out without testing.

---

## 4.4 Read / Upload Behavior

### Report 1
States that command:

`0111`

is used for PLU extraction or memory synchronization.

### Report 2
Associates read-like behavior with:

`0210`

especially for pushed sales/transaction records.

### Report 3
Could not confirm a public direct “read all PLUs” socket command, but found evidence for:

- Upload PLU,
- TXP files,
- TXU files,
- indirect export/import workflows.

### Combined Interpretation
There is no single uncontested read model.

### Safe Consolidated View
All of the following must remain possible:

- `0111` may be the direct PLU dump/extraction command,
- `0210` may represent pushed sales or weighing data,
- TXP/TXU workflows may be the documented indirect integration path.

---

# 5. Consolidated Technical Narrative

## 5.1 The Core Problem Being Solved
The three reports are not only about “talking to a scale.”  
They are really about replacing or bypassing a **legacy middleware-heavy architecture**.

This includes avoiding dependence on:

- vendor DLLs,
- background Windows services,
- file-watching middleware,
- import/export folders,
- platform-specific bridge software.

This is especially emphasized in Report 1 and supported indirectly by Report 3.

## 5.2 Why Direct Socket Integration Matters
Across the reports, direct integration is valuable because it can provide:

- lower latency,
- fewer moving parts,
- direct acknowledgment/error handling,
- improved control,
- easier integration with Node.js / Electron,
- less dependency on legacy Windows-only software,
- better cross-platform portability.

---

# 6. Network and Deployment Notes

## 6.1 IP Addressing

### Report 1
Suggests a possible default static IP such as:

- `192.168.1.87`

### Report 2
Uses:

- `192.168.1.100`

in sample code, likely as a test/example address.

### Report 3
Does not strongly claim a specific default IP.

### Combined Conclusion
The scale likely operates using a configurable static IPv4 setup, but no single IP can be treated as definitive across all reports.

## 6.2 Ethernet Details
Report 1 additionally mentions:

- standard Ethernet connectivity,
- standard RJ45,
- likely 10/100M support,
- preference for shielded twisted pair in noisy or harsh retail environments.

## 6.3 Local Device Configuration
Report 1 says the IP, subnet mask, and gateway may be configurable directly through the scale’s local system settings.

---

# 7. Handshake / Session Initialization

## 7.1 Report 1
Describes a handshake packet using:

- length = `0008`
- command = `0201`

Combined as:

`00080201`

It also says acknowledgments may involve:

- `0102`
- `0202`

Example response:

`0022010202100000010000`

Report 1 interprets such responses as containing:

- total length,
- acknowledgment command,
- referenced command,
- food code,
- error code.

## 7.2 Report 2
Also shows a handshake-like packet:

`00 08 02 01`

interpreted as:

- packet length = 8 bytes,
- command = start command.

## 7.3 Report 3
Supports a packet family consistent with this same general structure.

## 7.4 Combined Conclusion
The start/handshake model centered around **`0201`** is one of the strongest overlaps in the entire combined analysis.

---

# 8. Consolidated PLU Write / Update Analysis

## 8.1 Shared Core Conclusion
All three reports support **`0110`** as the leading candidate for PLU write/update behavior.

---

## 8.2 Report 1 Detailed PLU Write Structure

Report 1 describes `0110` as **PLU back stage sending** and says:

- total packet length = **108 bytes**
- header = **8 bytes**
- payload = **100 bytes**

Therefore packet begins with:

`006C0110`

because hex `6C` = decimal 108.

### Report 1 PLU Field Layout
1. Operate — 1 char — `I` insert/update, `D` delete  
2. Rank — 2 digits  
3. Name — 36 chars  
4. Fresh food code — 6 digits  
5. Art. No. — 10 digits  
6. Barcode type — 2 digits  
7. Unit price — 8 digits  
8. Weighing unit — 1 char  
9. Dept. — 2 digits  
10. Tare weight — 6 digits  
11. Saving period — 3 digits  
12. Packing type — 1 char  
13. Packing weight — 6 digits  
14. Packing error — 2 digits  
15. Message 1 — 3 digits  
16. Message 2 — 3 digits  
17. Multi-barcode — 3 digits  
18. Discount — 3 digits  
19. Sales mark — 1 char  
20. Discount mark — 1 char  

### Report 1 Additional Notes
- UTF-8 may cause byte-length problems in fixed-width fields.
- Legacy encodings such as **Windows-1256**, **CP864**, or **GB2312** may be required.
- Unit price is likely stored as an integer without decimal point in the payload.
- Shelf-life field may be used to compute expiry dates on printed labels.

---

## 8.3 Report 2 PLU Write Structure

Report 2 also supports `0110` and gives a simpler structure:

- operation (`I` / `D`)
- group
- PLU data

### Fields listed in Report 2
- PLU No. — 4 bytes
- Name — 36 bytes
- LFCode — 6 bytes
- Item Code — 10 bytes
- Barcode Type — 2 bytes
- Unit Price — 8 bytes
- Weight Unit — 1 byte
- Shelf Time — 3 bytes

---

## 8.4 Report 3 PLU Write Structure

Report 3 supports `0110` within the broader documented ecosystem and lists a strongly overlapping field universe including:

- operation flag,
- group/rank,
- name,
- fresh/LFCode,
- item code,
- barcode type,
- unit price,
- weight unit,
- department,
- tare,
- shelf time,
- packaging type,
- packaging weight,
- tolerance/packing error,
- message fields,
- multi-label or multi-barcode,
- discount/rebate,
- promotion flags,
- discount-enable flag.

Report 3 also warns that this may reflect host-software packet structure rather than confirmed direct-to-scale socket behavior.

---

## 8.5 Consolidated Write Conclusion
The strongest merged conclusion is:

- **`0110` is the leading candidate for PLU upload/update.**

The key unresolved question is whether that command is accepted:

- directly by the scale,
- or only through official PC-side software.

---

# 9. Consolidated Read / Upload / Extraction Analysis

## 9.1 Report 1
States that command:

`0111`

is used for PLU extraction or memory synchronization.

It also suggests that the scale may stream PLU records back using the same 100-byte-like data layout used in write operations.

It emphasizes that a Node.js implementation must handle:

- TCP fragmentation,
- packet boundaries,
- length-based parsing,
- field reconstruction from stream data.

## 9.2 Report 2
Associates read-like behavior more with:

`0210`

and describes this as possibly involving pushed sales or weighing data such as:

- command,
- scale number,
- unit price,
- weight,
- total amount.

## 9.3 Report 3
Does not confirm a public direct read-all-PLUs socket command, but does preserve evidence for:

- **Upload PLU** workflows,
- **TXP** full exports,
- **TXU** incremental/delta updates,
- fixed-width text record structures,
- CR/LF record endings,
- no-decimal price storage.

## 9.4 Consolidated Read Conclusion
All three read-related models must be preserved:

- `0111` may be direct PLU extraction,
- `0210` may be sales/push data,
- TXP/TXU may represent the most documented indirect workflow.

---

# 10. ACKs, Responses, Error Handling, and Flow Control

## 10.1 Report 1
This report provides the richest ACK/error handling model.

It states possible ACK commands:

- `0102`
- `0202`

Example:

`0022010202100000010000`

Possible response content:

- total length,
- ACK code,
- referenced command,
- food code,
- error code.

It also states:

- `0000` error code indicates success,
- non-zero indicates failure,
- application should wait for ACK before sending next message,
- scale may have limited buffering,
- invalid values may cause rejection.

Possible rejection causes include:

- invalid barcode format,
- unsupported values,
- out-of-range PLU numbers,
- device-side constraints.

## 10.2 Report 2
Provides only a lightweight sample socket example and does not deeply document ACK structure.

## 10.3 Report 3
Supports the need to capture real responses before hardcoding a parser.

## 10.4 Consolidated Conclusion
The safest implementation model is:

- assume the protocol is stateful,
- send commands sequentially,
- wait for ACK/response,
- parse responses carefully,
- confirm live behavior through testing.

---

# 11. Character Encoding and Multilingual Considerations

## 11.1 Report 1
This report discusses encoding most deeply.

It warns that Arabic names may break field alignment if encoded naively in UTF-8, because field width appears to be byte-based, not character-based.

Suggested legacy encodings include:

- Windows-1256,
- CP864,
- GB2312.

It recommends:

1. transcoding text,
2. measuring exact byte length,
3. padding/truncating carefully,
4. protecting downstream field positions.

## 11.2 Report 2
More briefly states that name encoding may vary by firmware, possibly between:

- UTF-8,
- GBK.

## 11.3 Report 3
Does not focus heavily on character encoding, but its fixed-width ecosystem observations support strict byte-count discipline.

## 11.4 Consolidated Encoding Conclusion
For Arabic and multilingual environments, byte-level field management is critical.  
Actual accepted encoding must be validated against the real device.

---

# 12. Price, Decimal Mode, Shelf Time, and PLU Semantics

## 12.1 Price Field Behavior
Across the reports, price appears to be stored as a numeric field with **implied decimals**.

Example:
- `15.50` may become `00001550`

This implies the application must align with the scale’s decimal interpretation rules.

## 12.2 Shelf Time / Saving Period
Reports 1 and 3 both preserve expiry-related product metadata such as:

- saving period,
- shelf time,
- shelf-life in days.

This may influence printed expiry date calculations.

## 12.3 Consolidated PLU Field Universe
Across all three reports, the combined set of PLU-related fields includes:

- operation flag,
- group/rank,
- PLU number,
- fresh food code / LFCode,
- product name,
- article/item code,
- barcode type,
- unit price,
- weight unit,
- department,
- tare,
- shelf time/saving period,
- packaging type,
- packaging weight,
- packing tolerance/error,
- message references,
- multi-barcode/multi-label,
- discount/rebate,
- promotion flags,
- discount-enable flag.

---

# 13. Unique Information from Each Report

---

## 13.1 Unique Information from Report 1 (.docx)

This report uniquely contributes the following:

- frames the work as replacing legacy middleware architecture,
- strongly identifies the device as **Rongta RLS1000 / RLS1100C lineage**,
- references a microcontroller/platform description including:
  - **NXP LPC1778FBD208**
  - ARM Cortex-M3
  - 120 MHz
  - 512 KB internal flash
  - 8 MB SDRAM
  - 16 MB NAND flash
- claims support for:
  - up to **10,000 PLUs**,
  - **140 membrane buttons**,
  - 28 function keys,
  - 112 direct hotkeys,
  - possibly more through shift functions
- mentions environmental resistance traits:
  - air-proof,
  - water-proof,
  - insect-proof
- mentions OEM software naming such as:
  - **RLS1000 Suite**
  - **Label Scale Software V1.0 / V2.0**
- suggests **Wireshark packet capture** as the practical reverse-engineering method,
- suggests possible default IP:
  - `192.168.1.87`
- recommends stateful flow control and ACK-driven sequencing,
- gives an Electron/Node architecture idea:
  - renderer triggers command,
  - main/background process formats and sends packet,
  - waits for ACK,
  - reports success/failure back to UI
- explicitly recommends handling:
  - timeouts,
  - `ECONNRESET`,
  - reconnect with exponential backoff.

---

## 13.2 Unique Information from Report 2 (Technical Documentation `.md`)

This report uniquely contributes:

- a compact and practical implementation-style summary,
- identification of the unit as **Rongta RLS1000 / RLS1100 OEM**,
- a statement that the scale may act as TCP client or server depending on configuration,
- default port claim:
  - `5001`
- protocol description:
  - binary / hex payload
- concise packet model:
  1. Packet Length — 4 bytes  
  2. Command Code — 4 bytes  
  3. Data Domain — variable
- a sample Node.js socket example using:
  - `net.Socket()`
  - `Buffer.alloc()`
  - `Buffer.concat()`
  - `writeUInt16BE()`
  - `writeUInt32BE()`
- sample config:
  - `SCALE_IP = '192.168.1.100'`
  - `SCALE_PORT = 5001`
- recommendation to test with official tools such as:
  - **Rongta RLS1000 SDK**
  - **Link65**

---

## 13.3 Unique Information from Report 3 (Deep Research `.md`)

This report uniquely contributes:

- the most cautious and uncertainty-aware interpretation,
- confirmation that public CityPos materials indicate:
  - 30 kg barcode label scale,
  - Ethernet/TCP-IP support,
  - but no public developer SDK or protocol spec found
- a strong suggestion that vendor workflow likely depends on:
  - official PC-side tools,
  - background services,
  - SDK/DLL-assisted integration
- likely ecosystem identifiers:
  - **Link32**
  - **Link65**
  - **Top / 顶尖 / Pinnacle / ACLAS**
- default port hypothesis:
  - `5002` most likely
  - `5001` fallback
- significance of:
  - **TXP** = full PLU export
  - **TXU** = delta/incremental update
- fixed-width records with:
  - CR/LF (`0x0D 0x0A`) endings
- no-decimal pricing patterns in the surrounding ecosystem
- explicit caution that host-side documented packet structures may not be identical to direct device socket packets.

---

# 14. Practical Combined Engineering Guidance

## 14.1 Port Testing Order
Test the following ports in controlled experiments:

1. `5002`
2. `5001`
3. `4000`
4. `5000`
5. `7778`

## 14.2 Framing Validation
Test both packet interpretations:

### Option A — ASCII-framed
Examples:
- `00080201`
- `006C0110...`

### Option B — Binary/hex-buffer framed
Construct using byte buffers and verify which style receives meaningful responses.

## 14.3 Initial Command Testing
Recommended first experiments:

- handshake/start candidate: `0201`
- write candidate: `0110`
- read candidate: `0111`
- push/sales candidate: `0210`

## 14.4 Encoding Validation
Test:

- plain ASCII product name,
- Arabic product name,
- legacy encoded field handling,
- exact byte-length padding.

## 14.5 Production Architecture Recommendation
For Node.js / Electron:

- keep socket communication outside renderer/UI thread,
- use Electron main process or background service,
- expose safe IPC methods,
- wait for ACK before next command,
- enforce timeout/retry strategy,
- support reconnect logic,
- log raw sent and received packets during testing.

---

# 15. Final Consolidated Conclusion

Taken together, the three reports strongly support the idea that the **CityPos CP-LWS201-BLA** can potentially be integrated through direct Ethernet/TCP communication from a custom application.

The strongest consolidated findings are:

- Ethernet/TCP integration is very likely possible,
- a start command resembling **`0201`** is strongly supported,
- **`0110`** is the strongest shared candidate for PLU write/update,
- the protocol likely uses fixed-width product fields,
- price likely uses an implied-decimal numeric representation,
- direct read behavior remains uncertain,
- the exact OEM family remains unresolved,
- the exact listening port remains unresolved,
- the exact framing style remains unresolved.

So the main remaining work is not conceptual anymore.  
It is **device validation work**:

1. identify the real open port,
2. identify the real framing format,
3. verify accepted command codes,
4. inspect ACK/error responses,
5. verify multilingual encoding behavior.

---

# 16. Consolidated Validation Checklist

## High-Confidence Items
- Barcode label weighing scale
- Ethernet/TCP-IP relevant
- Direct integration is plausible
- Packetized protocol
- Handshake likely required
- `0201` likely start command
- `0110` likely PLU write command
- Fixed-width PLU data likely important

## Open Questions
- Rongta-family or ACLAS/Top/Pinnacle-family?
- Port `4000`, `5001`, or `5002`?
- ASCII framing or binary framing?
- Is `0111` a true direct read command?
- Is `0210` sales push/reporting?
- What character encoding is required for Arabic names?

## Next Validation Actions
- port scan,
- packet capture during official software communication,
- replay handshake,
- replay one PLU write,
- inspect ACK,
- verify name rendering,
- compare against TXP/TXU if relevant.

---

# 17. Minimal Test Matrix

| Test ID | Purpose | Candidate |
|---|---|---|
| T1 | Port test | `5002` |
| T2 | Port test | `5001` |
| T3 | Port test | `4000` |
| T4 | Port test | `5000` |
| T5 | Port test | `7778` |
| T6 | Start handshake | `0201` |
| T7 | PLU write | `0110` |
| T8 | PLU read candidate | `0111` |
| T9 | Sales/push candidate | `0210` |
| T10 | Framing mode | ASCII |
| T11 | Framing mode | Binary |
| T12 | Text encoding | ASCII name |
| T13 | Text encoding | Arabic name |
| T14 | ACK parsing | `0102` / `0202` |
| T15 | File workflow fallback | TXP / TXU |

---

# 18. Developer Summary

The merged evidence indicates that the CityPos CP-LWS201-BLA is very likely a rebranded OEM barcode-label scale that may support direct TCP/IP integration. The strongest overlapping assumptions are a handshake command similar to `0201`, a PLU write command `0110`, fixed-width field formatting, and implied-decimal pricing. The biggest unresolved issues are the real OEM family, the real listening port, and whether the documented command set is accepted directly by the scale or only through official host-side software. Live packet capture and controlled testing are required before production implementation.

---