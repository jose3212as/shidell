const fs = require('fs');

async function testUpload() {
    try {
        // 1. Get users
        const usersRes = await fetch('http://localhost:8080/api/users');
        const users = await usersRes.json();
        
        // Find a teacher
        const docente = users.find(u => u.rol === 'DOCENTE');
        if (!docente) {
            console.log('No docente found');
            return;
        }
        console.log(`Docente found: ${docente.email} (ID: ${docente.id})`);

        // 2. Login
        const loginRes = await fetch('http://localhost:8080/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: docente.email, password: '123456' })
        });
        const loginData = await loginRes.json();
        const token = loginData.sessionToken;
        console.log('Logged in, token:', token.substring(0, 10) + '...');

        // 3. Upload image
        const imgPath = 'C:\\Users\\carlo\\.gemini\\antigravity\\brain\\d3c64dea-36a9-4b8d-9b02-29dc65352077\\test_avatar_1782704636677.jpg';
        const imgBuffer = fs.readFileSync(imgPath);
        const blob = new Blob([imgBuffer], { type: 'image/jpeg' });
        
        const formData = new FormData();
        formData.append('file', blob, 'test_avatar.jpg');

        const uploadRes = await fetch(`http://localhost:8080/api/users/${docente.id}/foto-perfil`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (uploadRes.ok) {
            const result = await uploadRes.json();
            console.log('UPLOAD SUCCESS!', result.fotoPerfil);
        } else {
            console.log('UPLOAD FAILED', uploadRes.status, await uploadRes.text());
        }

    } catch (e) {
        console.error(e);
    }
}
testUpload();
