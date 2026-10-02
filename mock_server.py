import http.server
import json
import socketserver

PORT = 8000

class MockAPIHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PATCH, PUT, DELETE')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_POST(self):
        if self.path == '/api/auth/login':
            content_length = int(self.headers['Content-Length'])
            post_data = json.loads(self.rfile.read(content_length))
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            response = {
                "token": "mock-token",
                "user": {
                    "id": "00000000-0000-0000-0000-000000000000",
                    "username": post_data.get("username", "admin"),
                    "display_name": "Admin",
                    "role": "super_admin",
                    "org_id": None,
                    "org_name": "System"
                }
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"detail": "Not found"}).encode())

    def do_GET(self):
        if self.path == '/api/auth/me':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "id": "00000000-0000-0000-0000-000000000000",
                "username": "admin",
                "display_name": "Admin",
                "role": "super_admin",
                "org_id": None,
                "org_name": "System"
            }
            self.wfile.write(json.dumps(response).encode())
        elif self.path == '/api/orgs/public':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"organizations": []}).encode())
        elif self.path == '/api/sessions?limit=50' or self.path == '/api/sessions':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"sessions": []}).encode())
        elif self.path == '/api/queues/paused':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"paused": 0, "flows": []}).encode())
        elif self.path == '/api/approvals/pending':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"approvals": []}).encode())
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"detail": "Not found"}).encode())

print(f"Starting mock API server on port {PORT}...")
with socketserver.TCPServer(("", PORT), MockAPIHandler) as httpd:
    httpd.serve_forever()
