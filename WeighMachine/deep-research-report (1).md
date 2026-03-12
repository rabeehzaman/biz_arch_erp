# Deep research on CityPos CP-LWS201-BLA Ethernet protocol and PLU data format

## Context and what can be proven from public sources

entity["company","CityPos","pos hardware saudi arabia"] markets the CP‑LWS201 family as a 30 kg barcode label scale with **RS232 + Ethernet + USB‑Host** connectivity. citeturn13view0turn14search3 In entity["company","CityPos","pos hardware saudi arabia"]’s own catalog PDF, CP‑LWS201 is described with a 105‑key keypad, support for “short PLU” keys, and the ability to edit parameters on PC and download them over “net” (network) or save/transfer via U‑disk. citeturn14search3

A key clue (and consistent with your “TM‑xA management program” note) is that the CP‑LWS201 feature set, port numbers, file/folder names, and management workflow match the widely rebranded **TM‑xA / JHScale ecosystem** documented across multiple vendors and manuals. citeturn8view0turn12view0turn6view0turn22search3

That matters because it lets us answer **ports** and **data file format** confidently from multiple independent sources, even if a CityPos-branded “SDK” PDF is not publicly posted.

## Device family identification and likely OEM lineage

Several independent documents describe a scale family that:

- Uses **Ethernet server port 33581** by default. citeturn8view0turn6view0turn12view0  
- Saves/loads configuration through a **USB folder named `JHSCALE`** with filenames like **`A_xxx.TMS`**. citeturn17view0turn12view0  
- Is managed by **TM‑xA management software**, and has an Ethernet “upload/download” workflow rather than a simple “REST API” style interface. citeturn6view0turn17view0turn12view0  
- Is explicitly attributed (as software) to entity["company","JHScale","scale software developer"] in software listings of TM‑xA. citeturn22search3  

Additionally, a product listing for a TM‑xA label printing scale shows **the same class of features** (RS232, Ethernet, USB-Host, 105 keys) that CityPos lists for CP‑LWS201. citeturn22search12turn14search3

**Most evidence-supported conclusion:** CityPos CP‑LWS201‑BLA is very likely a **rebranded TM‑xA/JHScale-compatible label scale** (or a very close derivative), not something using a entity["company","CAS Corporation","scale maker south korea"] or entity["company","Mettler Toledo","weighing instruments maker"] proprietary programming stack. citeturn22search3turn8view0turn14search3turn22search12

This doesn’t 100% guarantee identical firmware/protocol on every CityPos batch (rebrands sometimes request small customizations), but it strongly predicts:
- the **network ports**,
- the **presence of TMS (“Terminal Management System”) transfer files**, and
- the **shape of PLU data** inside those files. citeturn8view0turn12view0turn34view0turn34view1

## Ethernet communication details that are actually documented

### Default TCP/UDP ports used by the scale family

A widely distributed “Printing Serial Scale” / TM‑xA family manual lists the Ethernet ports (spec parameters 166–169) as:  
- **Scale’s server port:** **33581**  
- **Scale’s client port:** 33582  
- **Scale’s UDP local port:** 33583  
- **Scale’s UDP remote port:** 33584 citeturn8view0  

A separate software manual (for a rebrand using TM‑xA management) states the “factory standard” Ethernet connection uses **IP 192.168.0.150** and **port 33581**. citeturn6view0  

A entity["company","Detecto","scale brand us"] DL‑Series PC utility manual also instructs users to “verify the port number is set to **33581**” when adding the scale by IP. citeturn12view0  

**Answer for your item (1):** The default TCP port used by this ecosystem for PC↔scale Ethernet management is **33581** (scale side listening / “server port”). citeturn8view0turn6view0turn12view0

### Server vs client mode

The same manual family describes an Ethernet mode setting with:
- 0 = disable  
- 1 = server mode  
- 2 = client mode citeturn8view2  

**Practical interpretation (inference):** In “server mode,” the scale listens (typically on 33581) and the PC/software connects in. In “client mode,” the scale initiates the connection outward (and 33582 is likely involved as the client-side local port or expected opposite endpoint). The manuals disclose the ports and mode names, but do **not** publish a developer command reference explaining the client-mode socket behavior end-to-end. citeturn8view0turn8view2  

## The missing piece: no publicly posted byte-level TCP command protocol

Your core needs (2) and (3)—exact **byte/hex payload structure** for:

- writing PLUs (name, price, barcode elements, expiry), and  
- reading back PLUs from scale memory  

are **not** provided in the commonly available manuals for this family. One manual explicitly points RS232 POS integration to a separate “POS Protocol File,” implying protocol documentation exists but is not bundled in these public PDFs. citeturn8view4  

Across the sources above, what *is* described is:
- Ethernet exists and uses port 33581 by default, citeturn8view0turn12view0  
- PC software can upload/download data, citeturn12view0turn18view0  
- USB file transfer uses `JHSCALE\A_xxx.TMS`, citeturn12view0turn17view0  
but **the on-the-wire TCP frames and commands** are not documented publicly in the manuals themselves. citeturn8view4turn17view0turn12view0  

So: I cannot truthfully give you a verified “send these hex bytes to read all PLUs” command sequence for CityPos CP‑LWS201‑BLA, because I did not find a vendor-published Ethernet SDK/protocol document for that command layer. citeturn8view4turn13view0  

What I *can* give you (and this is often the fastest route to success) is the **actual PLU payload structure** used in the transfer files—because that has been reverse-engineered and implemented in open source.

## The PLU payload structure you can generate today: TMS file format

An open-source tool hosted on entity["company","GitHub","code hosting platform"] called “ScaleConfig” targets “Budry TM‑xA” scales and includes a complete **lossless parser/writer** for `.TMS` configuration files used by this ecosystem. citeturn25view1turn34view0turn34view1  

### High-level file structure

From the parser implementation:

- The file is treated as raw bytes and split into lines with detected line endings (`\r\n` vs `\n`). citeturn34view0  
- **Sections start** with a line beginning `XD1\t` and the section name is the second tab field (e.g., `XD1\tPLU\t`). citeturn34view0  
- **Sections end** with `END\t<SectionName>\t`. citeturn34view0  
- The file ends with an end marker line beginning `END\tECS` (the parser treats this as “end of file marker” and preserves trailing content). citeturn34view0  
- Within each section, each row is a tab-delimited record, preserving raw bytes for unknown fields (lossless round-trip). citeturn34view0turn34view3  

This is extremely useful for your Electron/Node integration because:
- Anything the official PC software transfers “into” the scale almost certainly corresponds to these same logical records.
- If you do a packet capture, you can search for recognizable ASCII like `XD1\tPLU\t` to locate where the payload is embedded (if not encrypted/compressed). citeturn34view0turn8view0  

### PLU record field positions (the important ones)

ScaleConfig’s field map defines these indices for the `PLU` section rows:

- `ID` = field index **1**  
- `UNIT_TYPE` = field index **4** (comment: `1=kg, 2=pcs`)  
- `PRICE` = field index **5** (comment example: `"600,0"`)  
- `PRICE_2` = index 6  
- `PRICE_3` = index 7  
- `DEPARTMENT` = index **14**  
- `NAME` = index **15**  
- `SHORT_CODE` = index **64** citeturn34view2  

The parser also shows that it expects (or at least commonly encounters) prices with a comma decimal separator such as `0,0` and `127,0`. citeturn34view1turn34view2  

### Creating a new PLU row

ScaleConfig’s writer implements `createPluRow()` and documents that it builds a “template” PLU row matching an observed 69-field format, and then fills in:

- kind = `PLU`  
- id  
- unit type  
- price  
- department  
- name  
and appends a long template tail of zeros/empty fields. citeturn34view1turn34view2  

That means you can generate **the raw bytes** for a PLU record deterministically in Node.js.

### What about barcode and expiry?

This is the tricky part.

- In many label scales, the “barcode on the label” is not stored as a single literal string per PLU. Instead, it’s derived from a **barcode format** + **item code / PLU number** + weight/price fields at print time. TM‑xA manuals describe selectable barcode formats and concepts like “Item-Code,” “Index Barcode,” and flag codes. citeturn7view0  
- For “expiry,” these scales often use **shelf life days** (a PLU attribute) plus the current date/time to print production/expiry dates, rather than storing a fixed expiry date in the PLU master record. TM‑xA documentation discusses “shelf days” configuration in the PLU/programming context. citeturn7view0  

ScaleConfig’s current open mapping exposes only a subset of PLU fields (name, prices, unit type, department, shortcode). The remaining fields (many of the 69) are unknown/unmapped in that tool, and could include item codes, tare, print format, barcode format selection, shelf day, etc. citeturn34view1turn34view2turn34view0  

So: you can *reliably* generate name/price/unit/department/shortcode today, but barcode/expiry likely requires either:
- mapping more PLU fields by comparing before/after TMS files, or  
- pulling the rest of the schema from the OEM’s unpublished documentation. citeturn34view1turn8view4  

## Practical Node.js payload examples you can use immediately

What follows are **verified-by-source** at the *payload* layer (TMS / PLU records). The remaining unknown is the *transport* layer (how exactly TM‑xA sends those bytes over TCP 33581).

### Example: hex bytes for a section marker and one PLU row

From the parser/writer logic, the fundamental byte conventions are:
- Tab byte = `0x09` citeturn34view0turn34view1  
- CR = `0x0D`, LF = `0x0A` citeturn34view0turn34view1  

So the ASCII line:

`XD1\tPLU\t` (with CRLF) is (hex):
- `58 44 31 09 50 4c 55 09 0d 0a`
  - `58 44 31` = “XD1”
  - `09` = tab
  - `50 4c 55` = “PLU”
  - `09` = tab
  - `0d 0a` = CRLF citeturn34view0  

A PLU line begins with the literal field `PLU` and the PLU id in field 1. citeturn34view2turn34view1  
So the first bytes of a PLU record will start with:

`50 4c 55 09` ( “PLU\t” )

### Example Node.js buffer builder for a PLU row compatible with this ecosystem

Below is an adaptation of the open-source `createPluRow()` logic (tab-delimited, 69+ fields, trailing tab). citeturn34view1turn34view2

```js
// Node.js: create a TM-xA / JHScale-style PLU row as raw bytes (UTF-8).
// Based on the documented field indexes and template approach from ScaleConfig.

function createPluRowBytes({ id, name, price, unitType = 1, department = 0 }) {
  // price format commonly appears as "600,0" etc in ecosystem files
  // unitType: 1=kg, 2=pcs (per fieldMap.ts)
  const templateTail = [
    '', '', '', '', '', '', '',           // [16-22] empty
    '0','0','0','0','0','0',              // [23-28]
    '0','0','0','0','0','0',              // [29-34]
    '0',                                  // [35]
    '0,0','0,0','0','0',                  // [36-39]
    '0,0','0,0','0,0','0','0',            // [40-44]
    '0,0','0,0','0,0','0','0',            // [45-49]
    '127,0','0,0','0,0','0','0',          // [50-54]
    '127,0','0,0','0,0','0','0',          // [55-59]
    '127','0','0','0','0',                // [60-64]
    '127','0','0','0',                    // [65-68]
    ''                                    // trailing empty (causes trailing tab)
  ];

  const fields = [
    'PLU',
    String(id),
    '0',
    '',
    String(unitType),
    String(price),
    '0,0',
    '0,0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    String(department),
    String(name),
    ...templateTail
  ];

  // Build raw bytes: join fields with \t, end with \t (because last field is '')
  const line = fields.join('\t') + '\t';
  return Buffer.from(line, 'utf8');
}

// Example usage:
const rowBuf = createPluRowBytes({
  id: 123,
  name: 'BEEF STEAK',
  price: '79,95',
  unitType: 1,
  department: 2
});

console.log('PLU row hex prefix:', rowBuf.subarray(0, 40).toString('hex'));
```

This yields a buffer whose internal structure matches the known assumptions:
- tab-separated fields, citeturn34view0turn34view1  
- required ID / price / department / name positions, citeturn34view2turn34view1  
- and a trailing tab field. citeturn34view1  

### Reading PLUs from a `.TMS` payload in Node.js

ScaleConfig’s parser logic shows that the PLU section can be located by:
- scanning for a section header line `XD1\tPLU\t`, then
- reading rows until the matching `END\tPLU\t`. citeturn34view0  

In Node, you can parse similarly:

```js
function extractPluRowsFromTmsBytes(bytes) {
  const text = Buffer.from(bytes).toString('utf8'); // best-effort
  const lines = text.split(/\r?\n/);

  let inPlu = false;
  const pluLines = [];

  for (const line of lines) {
    if (line.startsWith('XD1\tPLU\t')) { inPlu = true; continue; }
    if (inPlu && line.startsWith('END\tPLU\t')) { break; }
    if (inPlu && line.startsWith('PLU\t')) { pluLines.push(line); }
  }

  // Split a PLU line into fields and pick key indices per fieldMap
  return pluLines.map((line) => {
    const fields = line.split('\t');
    return {
      id: parseInt(fields[1] || '0', 10),
      unitType: parseInt(fields[4] || '1', 10),
      price: fields[5] || '0,0',
      department: parseInt(fields[14] || '0', 10),
      name: fields[15] || '',
      shortCode: fields[64] || ''
    };
  });
}
```

This matches the published field indices derived from the open-source field map. citeturn34view2turn34view0  

## How to bridge this into direct TCP/IP control

### What is known about the transport

- The scale listens on **TCP 33581** by default for management software connections. citeturn8view0turn6view0turn12view0  
- UDP ports 33583/33584 exist and may be used for discovery/status or auxiliary transfer steps (the manuals list them, but don’t specify message formats). citeturn8view0  
- PC utilities perform “Upload” and “Download” over Ethernet (functionally similar to USB import/export). citeturn12view0turn18view0  

### What is not known publicly

- The session handshake, framing, request opcodes, chunking, acknowledgements, and any authentication/encryption used over TCP 33581 are not described in publicly reachable manuals. citeturn8view4turn12view0turn8view0  

### Evidence-based reverse engineering strategy

If you want to avoid any Windows background service and talk directly from Node.js, the defensible approach is:

1. Use entity["company","Wireshark Foundation","network protocol analyzer project"] (or tshark) to capture traffic while the official TM‑xA software performs:
   - one “Download” of a small PLU set (e.g., 1 new PLU), and
   - one “Upload” (read-back). citeturn23search27turn23search0  

2. Filter capture by:
   - `tcp.port == 33581` (primary) and optionally
   - `udp.port == 33583 || udp.port == 33584` (discovery/aux). citeturn8view0turn23search27  

3. Search packet payload bytes for ASCII markers:
   - `XD1\tPLU\t`
   - `PLU\t`
   - `END\tPLU\t`
   - `END\tECS` citeturn34view0  

If these strings appear in the TCP stream, you’re in luck: your TCP payload is either literally the `.TMS` content or a very close cousin. If you only see binary, it may be compressed/encoded, or the scale uses a binary protocol that *contains* the same logical fields but not the text markers.

## Direct answers to your specific questions

## Default TCP port

**33581** (scale’s server port) is the default Ethernet TCP port used by this scale ecosystem for PC/management communication. citeturn8view0turn6view0turn12view0  
Related ports: 33582 (client), 33583/33584 (UDP local/remote). citeturn8view0  

## Write payload structure

A publicly documented “send these hex bytes to write PLU over TCP 33581” spec was not found. citeturn8view4turn12view0  

What *is* known and implementable is the **PLU payload itself** as a tab-delimited `.TMS` structure:
- Section markers: `XD1\t<name>\t` … `END\t<name>\t`, file end `END\tECS`. citeturn34view0  
- PLU row field indices: ID=1, UnitType=4, Price=5, Dept=14, Name=15, ShortCode=64. citeturn34view2  
- A common PLU row format is ~69 fields with a template tail. citeturn34view1  

So you can generate a correct PLU master payload (as bytes) even before you’ve decoded the TCP framing.

## Read payload structure

Same situation: the upload/read request framing over TCP is not published publicly. citeturn12view0turn8view4  

However, the data you want to *end up with* is very likely representable as:
- a PLU `XD1` section containing multiple `PLU\t...` rows, which you can parse and serialize using the logic above. citeturn34view0turn34view2  

## OEM protocol lineage

Based on:
- the exact port numbers (33581 etc), citeturn8view0turn6view0turn12view0  
- the `JHSCALE\A_xxx.TMS` file flow, citeturn12view0turn17view0  
- and the TM‑xA / JHScale software association, citeturn22search3turn22search12  

the CityPos CP‑LWS201‑BLA is most consistent with the **TM‑xA / JHScale-compatible retail label scale protocol family**, rather than a entity["company","Rongta Technology","printer maker china"]-specific or entity["company","CAS Corporation","scale maker south korea"]-specific protocol stack. citeturn22search3turn8view0turn14search3turn22search12  

## What developers have reverse-engineered so far

I did not find a published, verified “Wireshark dump + opcode list” specifically for “CityPos CP‑LWS201‑BLA” Ethernet frames. citeturn13view0turn23search27  

But developers *have* reverse-engineered enough of the ecosystem to:
- parse and write `.TMS` files used by TM‑xA devices (including PLU and keyboard mapping sections), citeturn34view0turn34view1turn34view2  
which is often the majority of the battle—because many vendor tools simply transport this content over TCP.

If you can share *one* packet capture (pcapng) from TM‑xA doing “Download PLU” and “Upload PLU,” the remaining step is to identify the stream framing and replicate it cleanly from Node.js. citeturn23search27turn34view0