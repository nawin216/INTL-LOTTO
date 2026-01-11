const API_BASE = '/api';
    let socket = null;
    let activeRoomId = null;
    let rooms = [];

    const roomListBody   = document.getElementById('room-list-body');
    const chatBox        = document.getElementById('admin-chat-box');
    const msgInput       = document.getElementById('admin-msg-input');
    const sendBtn        = document.getElementById('admin-send-btn');
    const imageInput     = document.getElementById('admin-image-input');
    const roomTitleEl    = document.getElementById('active-room-title');
    const roomSubEl      = document.getElementById('active-room-sub');

    function ensureLoggedIn() {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('กรุณาเข้าสู่ระบบแอดมินก่อน');
        window.location.href = '/index.html';
        return null;
      }
      return token;
    }

    function formatTime(dateStr) {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }

    function renderRooms() {
      if (!rooms.length) {
        roomListBody.innerHTML =
          '<div class="p-3 text-xs text-gray-400">ยังไม่มีห้องแชทจากลูกค้า</div>';
        return;
      }

      roomListBody.innerHTML = '';
      rooms.forEach((r) => {
        const div = document.createElement('div');
        div.className = 'room-item' + (r._id === activeRoomId ? ' active' : '');
        div.dataset.roomId = r._id;

        const title = r.user?.uid
          ? `UID: ${r.user.uid}`
          : r.user?.email || r._id;

        const subtitle = r.lastMessage || '(ยังไม่มีข้อความ)';
        const timeText = r.updatedAt ? formatTime(r.updatedAt) : '';

        div.innerHTML = `
          <div class="flex justify-between items-center mb-1">
            <div class="font-semibold text-xs text-gray-800 truncate">${title}</div>
            <div class="text-[10px] text-gray-400 ml-2">${timeText}</div>
          </div>
          <div class="text-[11px] text-gray-500 truncate">${subtitle}</div>
        `;

        div.addEventListener('click', () => selectRoom(r._id));
        roomListBody.appendChild(div);
      });
    }

    function addMessageBubble(msg) {
      const wrap = document.createElement('div');
      const isUser = msg.senderType === 'user';

      wrap.className = 'msg-bubble ' + (isUser ? 'msg-user' : 'msg-admin');

      if (msg.text) {
        const textEl = document.createElement('div');
        textEl.textContent = msg.text;
        wrap.appendChild(textEl);
      }

      if (msg.imageUrl) {
        const img = document.createElement('img');
        img.src = msg.imageUrl;
        img.className = 'img-msg';
        wrap.appendChild(img);
      }

      const timeEl = document.createElement('div');
      timeEl.className = 'msg-time';
      timeEl.textContent = formatTime(msg.createdAt || new Date());
      wrap.appendChild(timeEl);

      chatBox.appendChild(wrap);
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    async function loadRooms() {
      const token = ensureLoggedIn();
      if (!token) return;

      roomListBody.innerHTML =
        '<div class="p-3 text-xs text-gray-400">กำลังโหลดห้องแชท...</div>';

      try {
        const res = await fetch(`${API_BASE}/chat/rooms`, {
          headers: { Authorization: 'Bearer ' + token }
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          roomListBody.innerHTML =
            '<div class="p-3 text-xs text-red-400">โหลดห้องแชทไม่สำเร็จ</div>';
          return;
        }

        rooms = data.rooms || [];
        renderRooms();

        if (!activeRoomId && rooms.length) {
          selectRoom(rooms[0]._id);
        }
      } catch (err) {
        console.error('loadRooms error:', err);
        roomListBody.innerHTML =
          '<div class="p-3 text-xs text-red-400">โหลดห้องแชทไม่สำเร็จ</div>';
      }
    }

    async function selectRoom(roomId) {
      if (!roomId) return;
      activeRoomId = roomId;

      // update active class
      [...roomListBody.children].forEach((el) => {
        el.classList.toggle('active', el.dataset.roomId === roomId);
      });

      const room = rooms.find(r => r._id === roomId);
      const title = room?.user?.uid
        ? `UID: ${room.user.uid}`
        : room?.user?.email || roomId;

      roomTitleEl.textContent = title;
      roomSubEl.textContent = room?.user?.email || '';

      // join room via socket
      if (socket) socket.emit('chat:joinRoom', roomId);

      // load messages
      await loadMessages(roomId);
    }

    async function loadMessages(roomId) {
      const token = ensureLoggedIn();
      if (!token) return;
      chatBox.innerHTML = '<div class="p-3 text-xs text-gray-400">กำลังโหลดข้อความ...</div>';

      try {
        const res = await fetch(`${API_BASE}/chat/messages/${roomId}`, {
          headers: { Authorization: 'Bearer ' + token }
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          chatBox.innerHTML =
            '<div class="p-3 text-xs text-red-400">โหลดข้อความไม่สำเร็จ</div>';
          return;
        }

        chatBox.innerHTML = '';
        (data.messages || []).forEach(addMessageBubble);
      } catch (err) {
        console.error('loadMessages error:', err);
        chatBox.innerHTML =
          '<div class="p-3 text-xs text-red-400">โหลดข้อความไม่สำเร็จ</div>';
      }
    }

    function connectSocket() {
      const token = ensureLoggedIn();
      if (!token) return;

      socket = io('/', { auth: { token } });

      socket.on('connect_error', (err) => {
        console.error('socket connect_error:', err.message);
      });

      socket.on('chat:message', (msg) => {
        // ถ้าเป็นข้อความของห้องอื่น แค่ refresh rooms เพื่อให้ lastMessage อัปเดต
        if (msg.roomId !== activeRoomId) {
          loadRooms();
          return;
        }
        addMessageBubble(msg);
        loadRooms(); // อัปเดต updatedAt / lastMessage
      });
    }

    async function uploadImage(file) {
      const token = ensureLoggedIn();
      if (!token) return null;

      const form = new FormData();
      form.append('image', file);

      const res = await fetch(`${API_BASE}/chat/upload`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: form
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error('upload failed');
      return data.url;
    }

    sendBtn.addEventListener('click', async () => {
      const text = msgInput.value.trim();
      if (!text || !activeRoomId || !socket) return;

      socket.emit('chat:adminSend', {
        roomId: activeRoomId,
        text
      });
      msgInput.value = '';
    });

    msgInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendBtn.click();
      }
    });

    imageInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !activeRoomId || !socket) return;

      try {
        const url = await uploadImage(file);
        socket.emit('chat:adminSend', {
          roomId: activeRoomId,
          imageUrl: url
        });
      } catch (err) {
        console.error('upload image error:', err);
        alert('อัปโหลดรูปไม่สำเร็จ');
      } finally {
        imageInput.value = '';
      }
    });

    document.addEventListener('DOMContentLoaded', () => {
      ensureLoggedIn();
      connectSocket();
      loadRooms();
    });