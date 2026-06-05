async function loadUserBookings() {
    if (!currentUser) return;
    try {
        const res = await fetch('/api/bookings/list');
        if (!res.ok) return;
        const data = await res.json();
        const content = document.getElementById('profileContent');
        if (!content) return;
        if (data.bookings.length === 0) {
            content.innerHTML = `
                <div style="text-align:center; padding:3rem">
                    <h3>📋 У вас пока нет бронирований</h3>
                    <button class="auth-submit" onclick="showCatalog(); closeAllModals();" style="width:auto; margin-top:1rem">Перейти в каталог</button>
                </div>
            `;
            return;
        }
        const statusMap = { pending: '⏳ Ожидает', active: '✅ Активно', completed: '📋 Завершено', cancelled: '❌ Отменено' };
        content.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:1rem">
                ${data.bookings.map(b => `
                    <div style="background:var(--bg); padding:1rem; border-radius:15px">
                        <h4>Бронирование #${b.id}</h4>
                        <p>📅 ${b.startDate} — ${b.endDate} (${b.days} дн.)</p>
                        <p>📦 ${b.items.map(i => i.name).join(', ')}</p>
                        <p>💰 ${b.total.toLocaleString()} ₽</p>
                        <span style="display:inline-block; padding:0.3rem 1rem; border-radius:50px; background:${b.status === 'active' ? '#10b981' : '#f59e0b'}; color:white">${statusMap[b.status] || b.status}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } catch(e) { console.error(e); }
}