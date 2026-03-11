const net = require('net');

const PORTS_TO_TEST = [5001, 5002, 4000, 5000, 7778];

// The handshakes mentioned in the report
const asciiHandshake = '00080201';
const binaryHandshake = Buffer.from([0x00, 0x08, 0x02, 0x01]);

const targetIp = process.argv[2];

if (!targetIp) {
    console.log('Error: Please provide the IP address of the scale.');
    console.log('Usage: node scale-protocol-tester.js <scale-ip-address>');
    console.log('Example: node scale-protocol-tester.js 192.168.1.100');
    process.exit(1);
}

console.log(`\n🔍 Starting Scale Protocol Tester on IP: ${targetIp}`);
console.log('----------------------------------------------------');

async function testPort(port) {
    return new Promise((resolve) => {
        console.log(`\n⏱️ Attemping to connect to Port [${port}]...`);
        const socket = new net.Socket();

        // Set a timeout of 3 seconds per port
        socket.setTimeout(3000);

        socket.on('connect', () => {
            console.log(`✅ SUCCESS: Connected to Port [${port}]!`);

            // Step 1: Send the Binary Handshake
            console.log(`   ➡️ Sending Binary Handshake: [0x00, 0x08, 0x02, 0x01]`);
            socket.write(binaryHandshake);

            // Wait a bit, then send the ASCII handshake
            setTimeout(() => {
                console.log(`   ➡️ Sending ASCII Handshake: "00080201"`);
                socket.write(asciiHandshake);
            }, 1000);
        });

        socket.on('data', (data) => {
            console.log(`\n🎉 RECEIVED DATA FROM SCALE ON PORT [${port}]!`);
            console.log('   Raw Buffer:', data);
            console.log('   Hex String:', data.toString('hex'));
            console.log('   ASCII:', data.toString('ascii'));

            // We got a response, close and resolve successfully
            socket.destroy();
            resolve(true);
        });

        socket.on('timeout', () => {
            console.log(`❌ Timeout on Port [${port}]. No response or connection.`);
            socket.destroy();
            resolve(false);
        });

        socket.on('error', (err) => {
            console.log(`❌ Connection failed on Port [${port}]: ${err.message}`);
            socket.destroy();
            resolve(false);
        });

        // Attempt the connection
        socket.connect(port, targetIp);
    });
}

async function runTests() {
    let foundWorkingPort = false;

    for (const port of PORTS_TO_TEST) {
        const success = await testPort(port);
        if (success) {
            foundWorkingPort = true;
            console.log(`\n🚀 CONGRATULATIONS! Port ${port} is responding. We have our vector!`);
            break;
        }
    }

    if (!foundWorkingPort) {
        console.log('\n⚠️ All port tests failed. Please ensure the scale is powered on, connected to the same network, and that the IP address is correct.');
    } else {
        console.log('\n====================================================');
        console.log('Please copy the output of the 🎉 RECEIVED DATA section');
        console.log('and share it with me! I will write the final integration!');
        console.log('====================================================\n');
    }
}

runTests();
