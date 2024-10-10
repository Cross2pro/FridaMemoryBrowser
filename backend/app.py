from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_socketio import SocketIO, emit
import frida
import json
import os

# 获取当前文件的目录
current_dir = os.path.dirname(os.path.abspath(__file__))
# 构建到 frontend/dist 的路径
frontend_dist_dir = os.path.join(current_dir, '..', 'frontend', 'dist')

app = Flask(__name__, static_folder=frontend_dist_dir, static_url_path='')
socketio = SocketIO(app, cors_allowed_origins="*")

# 连接到目标进程
def get_device():
    return frida.get_usb_device()  # 或者使用其他方法获取设备

@app.route('/processes', methods=['GET'])
def get_processes():
    device = get_device()
    processes = device.enumerate_processes()
    return jsonify([{'pid': p.pid, 'name': p.name} for p in processes])
    
script = None

@app.route('/')
def index():
    return send_from_directory(frontend_dist_dir, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(frontend_dist_dir, path)

@app.route('/attach', methods=['POST'])
def attach():
    global script
    data = request.json
    pid = data.get('pid')
    script_code = open('../agent/membrowser.ts').read()
    device = get_device()
    session = device.attach(pid)
    script = session.create_script(script_code)
    
    def on_message(message, data):
        if message['type'] == 'send':
            socketio.emit('agent_message', message['payload'])
    
    script.on('message', on_message)
    script.load()
    return jsonify({'status': 'success'})

@socketio.on('read_memory')
def handle_read_memory(data):
    if script:
        script.post({'type': 'read_memory', 'address': data['address'], 'size': data['size']})
    else:
        emit('error', {'message': 'Agent not attached'})

@socketio.on('write_memory')
def handle_write_memory(data):
    if script:
        script.post({'type': 'write_memory', 'address': data['address'], 'data': data['data']})
    else:
        emit('error', {'message': 'Agent not attached'})

if __name__ == '__main__':
    socketio.run(app, debug=True)