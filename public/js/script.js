const API_URL = "/api";  // ✅ ตรวจสอบให้แน่ใจว่า API URL ถูกต้อง
// ✅ ล้าง token ที่หมดอายุออกจาก localStorage
const token = localStorage.getItem("token");
if (token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expired = payload.exp * 1000 < Date.now();
    if (expired) {
      console.log("🔴 Token หมดอายุแล้ว ลบออก");
      localStorage.removeItem("token");
    }
  } catch (err) {
    console.error("Token ผิดรูปแบบ:", err.message);
    localStorage.removeItem("token");
  }
}

// สลับฟอร์มสมัครสมาชิกและล็อกอิน
function showLoginForm() {
    document.getElementById("registerForm").classList.add("hidden");
    document.getElementById("loginForm").classList.remove("hidden");
}

function showRegisterForm() {
    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("registerForm").classList.remove("hidden");
}

// ✅ ฟังก์ชันสมัครสมาชิก
async function register() {
    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPassword").value;
    const messageBox = document.getElementById("registerMessage");

    // ตรวจสอบค่าว่าง
    if (!email || !password) {
        messageBox.textContent = "⚠ กรุณากรอกข้อมูลให้ครบถ้วน";
        messageBox.style.color = "orange";
        messageBox.style.visibility = "visible";
        return;
    }

    try {
        const res = await fetch(`${API_URL}/register`, {  // ✅ ตรวจสอบ URL API
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem("token", data.token); // ✅ เก็บ token ที่ได้จาก backend
            messageBox.textContent = "✅ สมัครสมาชิกสำเร็จ! กำลังไปหน้ากระเป๋าเงิน...";
            messageBox.style.color = "green";
            messageBox.style.visibility = "visible";
          
            setTimeout(() => {
              window.location.href = "wallet.html"; // ✅ ไปหน้า wallet ทันที
            }, 2000);
        } else {
            // ❌ สมัครไม่สำเร็จ
            messageBox.textContent = `❌ ${data.message}`;
            messageBox.style.color = "red";
            messageBox.style.visibility = "visible";
        }
    } catch (error) {
        messageBox.textContent = "❌ เกิดข้อผิดพลาดในการสมัครสมาชิก";
        messageBox.style.color = "red";
        messageBox.style.visibility = "visible";
    }
}

// ✅ ฟังก์ชันเข้าสู่ระบบ
async function login() {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;
    const messageBox = document.getElementById("loginMessage");

    if (!email || !password) {
        messageBox.textContent = "⚠ กรุณากรอกข้อมูลให้ครบถ้วน";
        messageBox.style.color = "orange";
        messageBox.style.visibility = "visible";
        return;
    }

    try {
        const res = await fetch(`${API_URL}/login`, {  // ✅ ตรวจสอบ URL API
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem("token", data.token);  // ✅ บันทึก Token
            messageBox.textContent = " เข้าสู่ระบบสำเร็จ! กำลังเปลี่ยนไปหน้ากระเป๋าเงิน...";
            messageBox.style.color = "green";
            messageBox.style.visibility = "visible";

            setTimeout(() => {
                window.location.href = "wallet.html";  // ✅ ไปหน้ากระเป๋าเงิน
            }, 2000);
        } else {
            messageBox.textContent = `❌ ${data.message}`;
            messageBox.style.color = "red";
            messageBox.style.visibility = "visible";
        }
    } catch (error) {
        messageBox.textContent = "  เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
        messageBox.style.color = "red";
        messageBox.style.visibility = "visible";
    }
}
