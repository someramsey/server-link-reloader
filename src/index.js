require('dotenv').config();

const http = require('http');
const port = process.env.PORT;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello, World!');
});

server.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
});

server.on('listening', () => {
    console.log('Server is up and running');
});