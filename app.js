import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://nhegpphykhwodrsocipp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZWdwcGh5a2h3b2Ryc29jaXBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDk5MzksImV4cCI6MjA4ODIyNTkzOX0._SLV1Mp3so3F5T2m7uFEXXzaiIUFE-1DtUnAy6fYeTg';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginForm    = document.getElementById("inicio-sesion");
const registroForm = document.getElementById("form-registro");
const mensajeLogin = document.getElementById("mensaje-inicio-sesion");

const mapas = {};
const viewTitles = {
  landing: 'PanchoBus', inicio: 'Inicio', rutas: 'Rutas y Mapa',
  planificador: 'Planificador', notificaciones: 'Notificaciones',
  perfil: 'Mi Perfil', ajustes: 'Ajustes', 'ruta-detalle': 'Detalle de Ruta'
};
const BNAV_VIEWS = ['inicio', 'rutas', 'planificador', 'notificaciones', 'perfil'];

// ── Init ─────────────────────────────────────
document.body.classList.add('public-view'); // default: landing shown first
verificarAutenticacion();
initTheme();

// ── Auth ──────────────────────────────────────
function verificarAutenticacion() {
  if (loginForm)    loginForm.addEventListener("submit", login);
  if (registroForm) registroForm.addEventListener("submit", registro);

  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      document.getElementById('sidebar').style.display = 'flex';
      document.getElementById('topbar').style.display  = 'flex';
      if (window.innerWidth <= 767)
        document.getElementById('bottom-nav').style.display = 'flex';

      cargarReservaActiva();
      actualizarBadgesNotificaciones(session.user.id);
      actualizarPerfilUI(session.user);
      showView('inicio');
    } else {
      document.getElementById('sidebar').style.display    = 'none';
      document.getElementById('topbar').style.display     = 'none';
      document.getElementById('bottom-nav').style.display = 'none';
      showView('landing');
    }
  });

  supabase.auth.getSession().catch(err => console.error(err.message));
}

function esCorreoUsfq(correo) {
  return correo.endsWith('@usfq.edu.ec') || correo.endsWith('@estud.usfq.edu.ec');
}

async function login(event) {
  event.preventDefault();
  const correo = document.getElementById("login-correo").value.trim();
  const pwd    = document.getElementById("login-pwd").value;

  if (!esCorreoUsfq(correo)) {
    mensajeLogin.textContent = "El correo debe pertenecer a la USFQ (@usfq.edu.ec o @estud.usfq.edu.ec).";
    mensajeLogin.style.color = "var(--red)";
    return;
  }

  mensajeLogin.textContent = "Iniciando sesión...";
  mensajeLogin.style.color = "var(--text-muted)";

  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: pwd });
  if (error) {
    mensajeLogin.textContent = "Error: " + error.message;
    mensajeLogin.style.color = "var(--red)";
    return;
  }
  mensajeLogin.textContent = "";
  loginForm.reset();
}

async function registro(event) {
  event.preventDefault();
  const nombre    = document.getElementById("reg-nombre").value.trim();
  const banner    = document.getElementById("reg-banner").value.trim();
  const telefono  = document.getElementById("reg-telefono").value.trim();
  const correo    = document.getElementById("reg-correo").value.trim();
  const pwd       = document.getElementById("reg-pwd").value;
  const pwd2      = document.getElementById("reg-pwd2").value;
  const rutaSel   = document.getElementById("reg-ruta").value;
  const msg       = document.getElementById("mensaje-registro");

  // Validar correo USFQ
  if (!esCorreoUsfq(correo)) {
    msg.textContent = "El correo debe pertenecer a la USFQ (@usfq.edu.ec o @estud.usfq.edu.ec).";
    msg.style.color = "var(--red)"; return;
  }
  // Validar código Banner (solo dígitos, 6-10 caracteres)
  if (!/^\d{6,10}$/.test(banner)) {
    msg.textContent = "El código Banner debe contener entre 6 y 10 dígitos numéricos.";
    msg.style.color = "var(--red)"; return;
  }
  // Validar teléfono (Ecuador: 10 dígitos, empieza en 09 o 02-07)
  if (!/^(09|0[2-7])\d{7,8}$/.test(telefono)) {
    msg.textContent = "Ingresa un número de teléfono ecuatoriano válido (ej. 0991234567).";
    msg.style.color = "var(--red)"; return;
  }
  // Validar contraseñas
  if (pwd !== pwd2) {
    msg.textContent = "Las contraseñas no coinciden.";
    msg.style.color = "var(--red)"; return;
  }
  if (pwd.length < 6) {
    msg.textContent = "La contraseña debe tener al menos 6 caracteres.";
    msg.style.color = "var(--red)"; return;
  }

  msg.textContent = "Creando cuenta...";
  msg.style.color = "var(--text-muted)";

  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: pwd,
    options: { data: { nombre, codigo_banner: banner } }
  });

  if (error) {
    msg.textContent = "Error: " + error.message;
    msg.style.color = "var(--red)"; return;
  }

  // Insertar en tabla usuarios
  if (data.user) {
    await supabase.from('usuarios').upsert([{
      id_usuario:         data.user.id,
      nombre,
      correo_electronico: correo,
      codigo_banner:      banner,
      telefono,
      id_ruta:            rutaSel ? parseInt(rutaSel) : null
    }], { onConflict: 'id_usuario' });
  }

  if (data.session === null) {
    msg.textContent = "✓ Cuenta creada. Revisa tu correo para confirmar.";
    msg.style.color = "#1a9e5c";
    registroForm.reset(); return;
  }
  msg.textContent = "✓ ¡Cuenta creada correctamente!";
  msg.style.color = "#1a9e5c";
}

async function cerrarSesion() {
  const { error } = await supabase.auth.signOut();
  if (error) { alert("Error al cerrar sesión: " + error.message); return; }
  window.location.reload();
}


// ── Cargar rutas en el select de registro ────
async function cargarRutasSelect() {
  const sel = document.getElementById('reg-ruta');
  if (!sel) return;
  const { data: rutas, error } = await supabase.from('rutas').select('id_ruta, nombre');
  if (error || !rutas?.length) return;
  sel.innerHTML = '<option value="">Selecciona tu ruta habitual (opcional)</option>' +
    rutas.map(r => `<option value="${r.id_ruta}">${r.nombre}</option>`).join('');
}

// ── UI: Tab switcher ──────────────────────────
function switchAuthTab(tab) {
  const panelLogin    = document.getElementById('panel-login');
  const panelRegistro = document.getElementById('panel-registro');
  const tabLogin      = document.getElementById('tab-login');
  const tabRegistro   = document.getElementById('tab-registro');

  if (tab === 'login') {
    panelLogin.style.display    = 'block';
    panelRegistro.style.display = 'none';
    tabLogin.classList.add('active');
    tabRegistro.classList.remove('active');
    document.getElementById('mensaje-inicio-sesion').textContent = '';
  } else {
    panelLogin.style.display    = 'none';
    panelRegistro.style.display = 'block';
    tabLogin.classList.remove('active');
    tabRegistro.classList.add('active');
    document.getElementById('mensaje-registro').textContent = '';
    cargarRutasSelect();
  }
}

// ── Perfil ────────────────────────────────────
function actualizarPerfilUI(user) {
  const nombre      = user.user_metadata?.nombre || user.email.split('@')[0];
  const iniciales   = nombre.substring(0, 2).toUpperCase();
  const banner      = user.user_metadata?.codigo_banner || "Sin ID";

  document.querySelectorAll('.user-name').forEach(el => el.textContent = nombre);
  document.querySelectorAll('.user-id').forEach(el => el.textContent = banner);
  document.querySelectorAll('.user-avatar').forEach(el => el.textContent = iniciales);

  const inputNombre = document.getElementById('ajustes-nombre');
  const inputId     = document.getElementById('ajustes-id');
  const inputCorreo = document.getElementById('ajustes-correo');
  if (inputNombre) inputNombre.value = nombre;
  if (inputId)     inputId.value     = banner;
  if (inputCorreo) inputCorreo.value = user.email;
}

async function guardarAjustes() {
  const nuevoNombre = document.getElementById('ajustes-nombre').value;
  const nuevoID     = document.getElementById('ajustes-id').value;
  if (!nuevoNombre || nuevoNombre.trim() === "") { alert("El nombre no puede estar vacío."); return; }

  const { data: authData, error: authError } = await supabase.auth.updateUser({
    data: { nombre: nuevoNombre, codigo_banner: nuevoID }
  });
  if (authError) { alert("Error al actualizar perfil: " + authError.message); return; }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    await supabase.from('usuarios')
      .update({ nombre: nuevoNombre, codigo_banner: nuevoID })
      .eq('id_usuario', sessionData.session.user.id);
  }
  alert("¡Perfil actualizado!");
  if (authData?.user) actualizarPerfilUI(authData.user);
}

// ── Rutas ─────────────────────────────────────
async function obtenerRutas() {
  const { data, error } = await supabase.from('rutas').select('*');
  if (error) { console.error(error.message); return []; }
  return data;
}

async function renderAllRoutes() {
  const container = document.getElementById('all-routes-list');
  if (!container) return;
  const rutas = await obtenerRutas();
  if (rutas.length === 0) {
    container.innerHTML = '<p class="text-center mt-3" style="font-size:.8rem;color:var(--text-muted);">No hay rutas disponibles.</p>';
    return;
  }
  container.innerHTML = rutas.map(r => {
    const libres = r.numero_asientos - r.asientos_ocupados;
    const badgeClass = (!r.disponible || libres <= 0) ? 'badge-red' : libres < 5 ? 'badge-gray' : 'badge-green';
    const badgeText  = (!r.disponible || libres <= 0) ? 'Sin espacio' : `${libres} asientos`;
    return `<div class="route-item">
      <div class="route-icon" onclick="verDetalleRuta(${r.id_ruta})" style="cursor:pointer;"><i class="bi bi-bus-front-fill"></i></div>
      <div style="flex:1;cursor:pointer;" onclick="verDetalleRuta(${r.id_ruta})">
        <div class="route-name">${r.nombre}</div>
        <div class="route-time">Bus: ${r.placa_bus} · <span style="color:var(--red);font-weight:600;">Ver detalle →</span></div>
      </div>
      <span class="route-badge ${badgeClass}" style="cursor:pointer;" onclick="${libres > 0 ? 'seleccionarRuta(' + r.id_ruta + ')' : ''}">${badgeText}</span>
    </div>`;
  }).join('');
}

async function renderPlanificadorRoutes() {
  const container = document.getElementById('planificador-routes-list');
  if (!container) return;
  const rutas = await obtenerRutas();
  container.innerHTML = rutas.map(r => {
    const libres = r.numero_asientos - r.asientos_ocupados;
    return `<div class="route-item ${libres <= 0 ? 'unavailable' : ''}" onclick="seleccionarRuta(${r.id_ruta})">
      <div class="route-icon"><i class="bi bi-calendar-check"></i></div>
      <div><div class="route-name">${r.nombre}</div><div class="route-time">Placa: ${r.placa_bus}</div></div>
      <span class="route-badge ${libres > 0 ? 'badge-green' : 'badge-red'}">${libres > 0 ? libres + ' cupos' : 'Lleno'}</span>
    </div>`;
  }).join('');
}


// ── Ver detalle de ruta ───────────────────────
async function verDetalleRuta(id_ruta) {
  showView('ruta-detalle');

  const infoEl    = document.getElementById('ruta-detalle-info');
  const paradasEl = document.getElementById('ruta-detalle-paradas');
  infoEl.innerHTML    = '<p style="color:var(--text-muted);font-size:.8rem;">Cargando...</p>';
  paradasEl.innerHTML = '';

  // Cargar ruta
  const { data: ruta } = await supabase.from('rutas').select('*').eq('id_ruta', id_ruta).single();
  if (!ruta) { infoEl.innerHTML = '<p style="color:var(--red);">Error al cargar ruta.</p>'; return; }

  const libres = ruta.numero_asientos - (ruta.asientos_ocupados || 0);
  infoEl.innerHTML = `
    <div class="section-title mb-3">${ruta.nombre}</div>
    <div class="d-flex flex-wrap gap-2 mb-3">
      <span class="route-badge ${libres > 0 ? 'badge-green' : 'badge-red'}" style="font-size:.75rem;padding:5px 12px;">${libres > 0 ? libres + ' asientos disponibles' : 'Sin espacio'}</span>
      ${ruta.disponible ? '' : '<span class="route-badge badge-red" style="font-size:.75rem;padding:5px 12px;">No disponible</span>'}
    </div>
    <div style="font-size:.82rem;color:var(--text);line-height:2;">
      <div><i class="bi bi-bus-front-fill text-red me-2"></i><b>Bus:</b> ${ruta.placa_bus}</div>
      <div><i class="bi bi-person-fill text-red me-2"></i><b>Chofer:</b> ${ruta.nombre_chofer || '—'}</div>
      <div><i class="bi bi-telephone-fill text-red me-2"></i><b>Contacto:</b> ${ruta.telefono_contacto || '—'}</div>
      <div><i class="bi bi-people-fill text-red me-2"></i><b>Asientos totales:</b> ${ruta.numero_asientos}</div>
    </div>
    ${libres > 0 ? `<button class="btn-red w-100 mt-3" onclick="seleccionarRuta(${ruta.id_ruta})"><i class="bi bi-calendar-check me-2"></i>Reservar asiento</button>` : ''}
  `;

  // Cargar paradas
  const { data: paradas } = await supabase.from('paradas').select('*').eq('id_ruta', id_ruta).order('id_parada');
  if (paradas?.length) {
    paradasEl.innerHTML = paradas.map((p, i) => `
      <div class="parada-item">
        <div class="parada-num">${i + 1}</div>
        <div style="flex:1;">
          <div style="font-size:.85rem;font-weight:600;color:var(--text);">${p.nombre}</div>
          <div style="font-size:.72rem;color:var(--text-muted);">Salida: ${p.hora_salida || '—'} · Regreso: ${p.hora_regreso || '—'}</div>
        </div>
      </div>`).join('');

    // Mapa del detalle
    setTimeout(() => {
      if (mapas['map-detalle']) {
        mapas['map-detalle'].remove();
        delete mapas['map-detalle'];
      }
      mapas['map-detalle'] = L.map('map-detalle').setView(
        [paradas[0].latitud || -0.196, paradas[0].longitud || -78.436], 13
      );
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap & CARTO'
      }).addTo(mapas['map-detalle']);

      const redPin = L.divIcon({
        className: '',
        html: `<div style="background:var(--red);width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>`,
        iconSize: [14,14], iconAnchor: [7,7]
      });

      const coords = [];
      paradas.forEach((p, i) => {
        if (!p.latitud || !p.longitud) return;
        coords.push([p.latitud, p.longitud]);
        L.marker([p.latitud, p.longitud], { icon: redPin })
          .addTo(mapas['map-detalle'])
          .bindPopup(`<div style="font-family:Poppins,sans-serif"><b>${i+1}. ${p.nombre}</b><br>Salida: ${p.hora_salida || '—'}</div>`);
      });
      if (coords.length > 1) {
        L.polyline(coords, { color: '#ed1c24', weight: 3, opacity: .7 }).addTo(mapas['map-detalle']);
        mapas['map-detalle'].fitBounds(coords);
      }
    }, 100);
  } else {
    paradasEl.innerHTML = '<p style="font-size:.8rem;color:var(--text-muted);">Sin paradas registradas.</p>';
  }
}

// ── Mapas (Leaflet) ───────────────────────────
async function cargarMapa(idContenedor) {
  if (mapas[idContenedor]) {
    setTimeout(() => mapas[idContenedor].invalidateSize(), 200);
    return;
  }
  mapas[idContenedor] = L.map(idContenedor).setView([-0.196, -78.436], 14);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap & CARTO'
  }).addTo(mapas[idContenedor]);

  const redPin = L.divIcon({
    className: '',
    html: `<div style="background:var(--red);width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7]
  });

  const { data: paradas, error } = await supabase.from('paradas').select('*');
  if (!error && paradas) {
    paradas.forEach(p => {
      L.marker([p.latitud, p.longitud], { icon: redPin })
       .addTo(mapas[idContenedor])
       .bindPopup(`<div style="font-family:Poppins,sans-serif"><b>${p.nombre}</b><br>Salida: ${p.hora_salida}</div>`);
    });
  }
}

// ── Reservas ──────────────────────────────────
async function seleccionarRuta(id_ruta) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { alert("Debes iniciar sesión para reservar."); return; }

  const { data: ruta } = await supabase.from('rutas')
    .select('numero_asientos, asientos_ocupados, nombre')
    .eq('id_ruta', id_ruta).single();
  if (!ruta) return;
  if (ruta.asientos_ocupados >= ruta.numero_asientos) {
    alert("¡Uy! Esta ruta ya está llena."); return;
  }

  const { error } = await supabase.from('reservas')
    .insert([{ id_usuario: session.user.id, id_ruta, estado: 'activa' }]);
  if (error) { alert("Error al confirmar la reserva."); return; }

  await supabase.from('rutas')
    .update({ asientos_ocupados: ruta.asientos_ocupados + 1 })
    .eq('id_ruta', id_ruta);

  alert(`¡Reserva confirmada para ${ruta.nombre}!`);
  cargarReservaActiva();
  renderAllRoutes();
  renderPlanificadorRoutes();
  showView('planificador');
}

async function cancelarReservaEspecifica(id_reserva, id_ruta) {
  if (!confirm("¿Cancelar este viaje?")) return;

  await supabase.from('reservas').update({ estado: 'cancelada' }).eq('id_reserva', id_reserva);
  const { data: ruta } = await supabase.from('rutas').select('asientos_ocupados').eq('id_ruta', id_ruta).single();
  if (ruta?.asientos_ocupados > 0)
    await supabase.from('rutas').update({ asientos_ocupados: ruta.asientos_ocupados - 1 }).eq('id_ruta', id_ruta);

  alert("Reserva cancelada.");
  cargarReservaActiva();
  renderAllRoutes();
  renderPlanificadorRoutes();
}

async function cargarReservaActiva() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { data: reservas } = await supabase.from('reservas')
    .select('*, rutas(*)')
    .eq('id_usuario', session.user.id)
    .eq('estado', 'activa');
  actualizarEstadoReservaUI(reservas);
}

function actualizarEstadoReservaUI(reservas) {
  const contInicio = document.getElementById('contenedor-reservas-inicio');
  const contPlan   = document.getElementById('contenedor-reservas-planificador');
  if (!contInicio || !contPlan) return;

  if (reservas && reservas.length > 0) {
    contInicio.innerHTML = reservas.map(res => `
      <div id="today-trip" style="background:var(--red);margin-bottom:12px;border-radius:var(--radius);padding:20px 24px;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:16px;">
        <div class="trip-info">
          <div class="lbl"><i class="bi bi-bus-front-fill me-1"></i>Viaje Reservado</div>
          <div class="val">${res.rutas.placa_bus} — ${res.rutas.nombre}</div>
          <div class="sub">Tu cupo está asegurado</div>
        </div>
        <button class="btn-dark-sm" style="background:rgba(0,0,0,.35);" onclick="cancelarReservaEspecifica(${res.id_reserva},${res.id_ruta})">CANCELAR</button>
      </div>`).join('');

    contPlan.innerHTML = reservas.map(res => `
      <div class="card-red" style="margin-bottom:12px;">
        <div style="font-size:.7rem;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;opacity:.8;">Ruta Reservada</div>
        <div style="font-size:1.5rem;font-weight:800;margin:6px 0 2px;">${res.rutas.placa_bus} — ${res.rutas.nombre}</div>
        <div style="font-size:.85rem;opacity:.85;">ID de Reserva: #${res.id_reserva}</div>
        <button class="btn-dark-sm mt-3" onclick="cancelarReservaEspecifica(${res.id_reserva},${res.id_ruta})">CANCELAR RESERVA</button>
      </div>`).join('');

    renderCalendario(reservas);
  } else {
    contInicio.innerHTML = `
      <div style="background:var(--gray);border-radius:var(--radius);padding:20px 24px;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:16px;">
        <div><div style="font-size:.7rem;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;opacity:.8;"><i class="bi bi-bus-front-fill me-1"></i>Tu viaje de hoy</div>
        <div style="font-size:1.5rem;font-weight:800;margin:2px 0;">Sin reserva activa</div>
        <div style="font-size:.8rem;opacity:.85;">Busca una ruta en el planificador</div></div>
        <button class="btn-dark-sm" onclick="showView('planificador')">VER PLANIFICADOR</button>
      </div>`;
    contPlan.innerHTML = `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
        <div class="section-title">Estado de reserva</div>
        <div style="font-size:1.1rem;font-weight:700;color:var(--text);">Sin reserva activa</div>
        <div style="font-size:.8rem;color:var(--text-muted);margin-top:4px;">Selecciona una ruta abajo para viajar hoy</div>
      </div>`;
    renderCalendario(null);
  }
}

function renderCalendario(reservas) {
  const container = document.getElementById('calendario-dinamico');
  if (!container) return;
  const dias  = ['', 'L', 'M', 'Mi', 'J', 'V'];
  const horas = ['3:30', '4:00', '4:30', '5:00', '5:30'];
  let diaActual = new Date().getDay();
  if (diaActual === 0 || diaActual === 6) diaActual = 1;

  let html = '<div></div>' + dias.slice(1).map(d => `<div class="cal-header">${d}</div>`).join('');
  horas.forEach((hora, idx) => {
    html += `<div class="cal-time">${hora}</div>`;
    for (let dia = 1; dia <= 5; dia++) {
      if (dia === diaActual && reservas?.[idx]) {
        const n = reservas[idx].rutas.nombre.split(' ').slice(0,2).join(' ');
        html += `<div class="cal-cell booked" style="font-size:.6rem;padding:2px;text-align:center;">${n}</div>`;
      } else {
        html += `<div class="cal-cell"></div>`;
      }
    }
  });
  container.innerHTML = html;
}

// ── Notificaciones ────────────────────────────
async function actualizarBadgesNotificaciones(userId) {
  const { count } = await supabase.from('notificaciones')
    .select('*', { count: 'exact', head: true })
    .or(`id_usuario.eq.${userId},id_usuario.is.null`);
  const bSidebar = document.getElementById('badge-sidebar');
  const bNav     = document.getElementById('badge-bnav');
  if (count > 0) {
    if (bSidebar) { bSidebar.textContent = count; bSidebar.style.display = 'inline-block'; }
    if (bNav)     { bNav.textContent = count;     bNav.style.display = 'flex'; }
  } else {
    if (bSidebar) bSidebar.style.display = 'none';
    if (bNav)     bNav.style.display = 'none';
  }
}

async function renderNotificaciones() {
  const container = document.getElementById('lista-notificaciones');
  if (!container) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: notifs, error } = await supabase.from('notificaciones')
    .select('*')
    .or(`id_usuario.eq.${session.user.id},id_usuario.is.null`)
    .order('fecha_creacion', { ascending: false });

  if (error || !notifs?.length) {
    container.innerHTML = '<p class="text-center mt-3" style="font-size:.8rem;color:var(--text-muted);">No tienes notificaciones nuevas.</p>';
    return;
  }
  const iconoMap = { green: 'bi-check-circle-fill', red: 'bi-exclamation-octagon-fill', warn: 'bi-exclamation-triangle-fill' };
  container.innerHTML = notifs.map(n => {
    const icono = iconoMap[n.tipo] || 'bi-bell-fill';
    const hora  = new Date(n.fecha_creacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<div class="notif-card">
      <div class="notif-icon ${n.tipo}"><i class="bi ${icono}"></i></div>
      <div class="flex-grow-1"><div class="notif-title">${n.titulo}</div><div class="notif-sub">${n.mensaje || ''}</div></div>
      <div class="notif-time">${hora}</div>
    </div>`;
  }).join('');
}


async function marcarTodasLeidas() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  // Marcar como leídas las notificaciones propias del usuario
  await supabase.from('notificaciones')
    .update({ leida: true })
    .eq('id_usuario', session.user.id);

  // Refrescar lista y quitar badges
  renderNotificaciones();
  const bSidebar = document.getElementById('badge-sidebar');
  const bNav     = document.getElementById('badge-bnav');
  if (bSidebar) bSidebar.style.display = 'none';
  if (bNav)     bNav.style.display     = 'none';
}

// ── Navegación ────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + name);
  if (target) target.classList.add('active');

  // Public views (landing, login) get no sidebar offset
  const isPublic = name === 'landing' || name === 'login';
  document.body.classList.toggle('public-view', isPublic);

  document.querySelectorAll('.nav-item-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.view === name)
  );
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = viewTitles[name] || name;

  if      (name === 'landing')        { /* public, no auth needed */ }
  else if (name === 'rutas')          { renderAllRoutes();          setTimeout(() => cargarMapa('map-rutas'), 50); }
  else if (name === 'inicio')         { setTimeout(() => cargarMapa('map-inicio'), 50); cargarReservaActiva(); }
  else if (name === 'planificador')   { renderPlanificadorRoutes(); cargarReservaActiva(); }
  else if (name === 'notificaciones') { renderNotificaciones(); }

  updateBottomNav(name);
  closeSidebarMobile();
}

function updateBottomNav(name) {
  BNAV_VIEWS.forEach(v => {
    const btn = document.getElementById('bnav-' + v);
    if (btn) btn.classList.toggle('active', v === name);
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen  = sidebar.classList.toggle('sidebar-open');
  overlay.classList.toggle('overlay-visible', isOpen);
}

function closeSidebarMobile() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar.classList.contains('sidebar-open')) {
    sidebar.classList.remove('sidebar-open');
    overlay.classList.remove('overlay-visible');
  }
}

// ── Tema ──────────────────────────────────────
function toggleDark(checkbox) {
  const isDark = checkbox.checked;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.querySelectorAll('.dark-toggle').forEach(t => { t.checked = isDark; });
  localStorage.setItem('pb-theme', isDark ? 'dark' : 'light');
}

function initTheme() {
  const saved = localStorage.getItem('pb-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.querySelectorAll('.dark-toggle').forEach(t => { t.checked = true; });
  }
}

// ── Exponer funciones al scope global ─────────
window.showView                  = showView;
window.verDetalleRuta            = verDetalleRuta;
window.marcarTodasLeidas         = marcarTodasLeidas;
window.cargarRutasSelect         = cargarRutasSelect;
window.switchAuthTab             = switchAuthTab;
window.toggleDark                = toggleDark;
window.toggleSidebar             = toggleSidebar;
window.guardarAjustes            = guardarAjustes;
window.cancelarReservaEspecifica = cancelarReservaEspecifica;
window.seleccionarRuta           = seleccionarRuta;
window.cerrarSesion              = cerrarSesion;