# CityPos CP-LWS201-BLA Scale: Technical Integration Guide for Node.js/Electron

## 1. Introduction

This document provides a technical guide for integrating with the CityPos CP-LWS201-BLA (30KG Barcode Label Scale) via an Ethernet (TCP/IP) connection. The goal is to enable custom POS/ERP applications, particularly those built with Electron and Node.js, to communicate directly with the scale for tasks such as uploading new Product Look-Up (PLU) data and reading existing PLU information. This guide synthesizes information gathered from user manuals, open-source projects, and technical documentation related to similar scales and the "TM XA Management Program."

## 2. OEM Identification and Software

The CityPos CP-LWS201-BLA scale appears to be a rebranded product from **Shanghai Jinghan Information Technology Co., Ltd. (JHScale)**. This is indicated by the consistent mention of the "JHSCALE" directory for USB data transfers and the use of the "TM-xA Management Program" software, which is also associated with other rebranded scales like Detecto's DL series [1].

## 3. TCP/IP Communication Details

### 3.1 Default TCP Port

Based on analysis of the "TM-xA Management Program" and related documentation, the default TCP port used for Ethernet communication with the scale is **33581** [2]. This port is consistently referenced in contexts where the PC utility connects to the scale over a network.

### 3.2 Inferred Communication Protocol

The scale's communication protocol, particularly for PLU data transfer, is strongly inferred to be a **tab-separated value (TSV) format**. This is evidenced by the structure of the `.TMS` files used for USB-based data updates, which are essentially TSV files with specific headers and section markers. It is highly probable that the TCP/IP communication follows a similar, if not identical, text-based, line-delimited (CRLF) protocol.

## 4. .TMS File Structure and PLU Data Fields

The `.TMS` file format is central to understanding how PLU data is structured and exchanged with the scale. These files are used by the "TM-xA Management Program" for both uploading and downloading scale configurations and PLU data.

### 4.1 General File Structure

The `.TMS` files are plain text files organized into sections, with each line representing a record or a part of a record. Key markers include:

*   **File Header:** `XD1\t<Version>` (e.g., `XD1\tV2.52F`). This marks the beginning of the file and indicates the file format version.
*   **Section Headers:** Each data section (PLU, SCP, DPT, CLS) begins with a header like `XD1\tPLU`.
*   **Section End Markers:** Each section concludes with a marker such as `END\tPLU`.
*   **File End Marker:** The entire file terminates with `END\tECS`.

### 4.2 PLU Record Structure

PLU records are typically found within the `XD1\tPLU` and `END\tPLU` markers. Each PLU record is a single line of tab-separated values. While the exact number of fields can vary, a common structure, as observed in the `ScaleConfig` open-source project [3], includes approximately 69 fields. The most relevant fields for your integration are:

| Field Index | Description     | Example Value | Notes                                                              |
|-------------|-----------------|---------------|--------------------------------------------------------------------|
| 0           | Record Type     | `PLU`         | Literal string indicating a PLU record                             |
| 1           | PLU ID          | `1001`        | Unique identifier for the product                                  |
| 4           | Unit Type       | `1`           | `1` for kilograms (kg), `2` for pieces (pcs)                       |
| 5           | Price           | `600,0`       | Price per unit. Note the comma as a decimal separator.             |
| 14          | Department ID   | `1`           | Identifier for the product's department                            |
| 15          | Product Name    | `Apples`      | Name of the product                                                |
| 64          | Short Code      | `APP`         | Abbreviated code for quick access                                  |
| 16-68       | Other Fields    | `0`, `0,0`, `127` | These fields often contain default values or are left empty.       |

## 5. Node.js Integration Examples

To communicate with the scale, you will need to establish a TCP connection to the scale's IP address on port 33581. The data sent and received will be in the tab-separated value format, terminated by CRLF (`\r\n`).

### 5.1 Establishing a TCP Connection

```javascript
const net = require('net');

const SCALE_IP = '192.168.0.150'; // Example IP, replace with your scale's IP
const SCALE_PORT = 33581;

const client = new net.Socket();

client.connect(SCALE_PORT, SCALE_IP, () => {
  console.log('Connected to scale');
  // Connection established, now send/receive data
});

client.on('data', (data) => {
  console.log('Received from scale:', data.toString());
  // Process incoming data
});

client.on('close', () => {
  console.log('Connection closed');
});

client.on('error', (err) => {
  console.error('Connection error:', err);
});
```

### 5.2 Writing PLU Data (Uploading)

To upload a new PLU, you need to construct a string in the `.TMS` format, encode it into a buffer, and send it over the TCP connection. The `ScaleConfig` project's `writer.ts` provides a good reference for how these files are constructed [4].

Here's a simplified example for constructing a single PLU record. For a full `.TMS` file, you would include the file header, section headers, and end markers.

```javascript
function createPluRecord(pluData) {
  const fields = new Array(69).fill(''); // Initialize with 69 empty fields

  fields[0] = 'PLU';
  fields[1] = pluData.id.toString();
  fields[4] = pluData.unitType.toString(); // 1=kg, 2=pcs
  fields[5] = pluData.price.replace('.', ','); // Replace decimal point with comma
  fields[14] = pluData.departmentId.toString();
  fields[15] = pluData.productName;
  fields[64] = pluData.shortCode;

  // Fill other known default fields if necessary, based on ScaleConfig's PLU_TEMPLATE_TAIL
  // For simplicity, we'll assume most other fields can be empty or default to '0'
  fields[16] = ''; // Example: empty field
  fields[17] = ''; // Example: empty field
  // ... up to field 68

  return fields.join('\t') + '\r\n'; // Join with tabs and add CRLF
}

// Example PLU data
const newPlu = {
  id: 100,
  unitType: 1, // kg
  price: '12.50',
  departmentId: 1,
  productName: 'Organic Bananas',
  shortCode: 'BAN'
};

const pluRecord = createPluRecord(newPlu);

// To send a full .TMS file, you would wrap this in the appropriate headers and footers:
const tmsContent = [
  'XD1\tV2.52F\r\n', // Example version
  'XD1\tPLU\r\n',
  pluRecord,
  'END\tPLU\r\n',
  'END\tECS\r\n'
].join('');

// Send the data over the TCP connection
// client.write(tmsContent);
console.log('Generated TMS content for PLU upload:\n', tmsContent);
```

### 5.3 Reading PLU Data (Downloading)

Direct commands to request all PLUs were not explicitly found in the available documentation. However, if the scale's "TM XA Management Program" can download PLUs, it implies a mechanism exists. This might involve sending a specific command to trigger a data dump from the scale, which would then transmit data in the `.TMS` format over the TCP connection. You would then parse this incoming data.

Parsing incoming data would involve:
1.  Reading the incoming byte stream.
2.  Identifying line endings (`\r\n`).
3.  Splitting lines and then splitting each line by the tab character (`\t`).
4.  Identifying section headers (e.g., `XD1\tPLU`) and end markers (e.g., `END\tPLU`).
5.  Extracting PLU data from lines within the `PLU` section based on the field indices described above.

The `ScaleConfig` project's `parser.ts` file demonstrates the logic for parsing such `.TMS` files [5].

## 6. Caveats and Next Steps

*   **Exact Command Structures:** While the `.TMS` file structure provides a strong indication of the data format, the precise TCP commands for initiating uploads, downloads, or other real-time operations are not explicitly documented. **Wireshark analysis** of the official "TM XA Management Program" communicating with the scale would be the most effective way to reverse-engineer these commands.
*   **Error Handling:** Robust error handling and retry mechanisms will be crucial for a production-ready integration.
*   **Checksums/CRCs:** Some protocols include checksums or Cyclic Redundancy Checks (CRCs) for data integrity. This protocol's use of such mechanisms is unknown and would require further investigation (e.g., via Wireshark).
*   **Real-time Weight Data:** This guide focuses on PLU management. Obtaining real-time weight data would likely involve a different set of commands or a continuous data stream from the scale.

**Recommended Next Steps:**
1.  Perform Wireshark capture of the "TM XA Management Program" interacting with the CityPos scale to identify the exact byte/hex commands for PLU upload and download.
2.  Implement a Node.js TCP client that sends the inferred commands and parses the responses based on the `.TMS` file structure.
3.  Thoroughly test the integration with the physical scale.

## References

[1] [DLX50 DL Series Scale PC Utility Manual](https://cardinalscale.com/themes/ee/site/default/asset/img/resources/resources_brochures/8529-0638-0M_DLX50_PC_Utility_Manual.pdf)
[2] [2 TM A Install Driver and Connect via LAN - YouTube](https://www.youtube.com/watch?v=wegcMc469x4)
[3] [ScaleConfig/frontend/src/parser/fieldMap.ts at main · Geansix7/ScaleConfig · GitHub](https://github.com/Geansix7/ScaleConfig/blob/main/frontend/src/parser/fieldMap.ts)
[4] [ScaleConfig/frontend/src/parser/writer.ts at main · Geansix7/ScaleConfig · GitHub](https://github.com/Geansix7/ScaleConfig/blob/main/frontend/src/parser/writer.ts)
[5] [ScaleConfig/frontend/src/parser/parser.ts at main · Geansix7/ScaleConfig · GitHub](https://github.com/Geansix7/ScaleConfig/blob/main/frontend/src/parser/parser.ts)
