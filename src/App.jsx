import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

// ==========================================
// 📱 VISTA DEL OPERADOR (Con Solicitud de Acceso)
// ==========================================
const PortalOperador = () => {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  // Estados de formulario auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados de reporte
  const [activos, setActivos] = useState([]);
  const [activoSeleccionado, setActivoSeleccionado] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [urgencia, setUrgencia] = useState('Media');
  const [foto, setFoto] = useState(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // Cargar perfil del obrero y activos
  useEffect(() => {
    if (session) {
      supabase.from('trabajadores').select('*').eq('id', session.user.id).single()
        .then(({ data }) => setPerfil(data));
        
      supabase.from('activos').select('*').then(({ data }) => setActivos(data || []));
    }
  }, [session]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (isLoginMode) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert("Error: " + error.message);
    } else {
      // Registro de Obrero nuevo
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        alert("Error: " + error.message);
      } else if (data.user) {
        await supabase.from('trabajadores').insert([{ id: data.user.id, nombre, email, estado: 'Pendiente' }]);
        alert("Solicitud enviada al supervisor.");
      }
    }
    setLoading(false);
  };

  const enviarReporte = async (e) => {
    e.preventDefault();
    setLoading(true);
    let fotoUrlFinal = null;

    if (foto) {
      const fileName = `${Date.now()}_${foto.name}`;
      const { error: uploadError } = await supabase.storage.from('failure-photos').upload(fileName, foto);
      if (!uploadError) {
        const { data } = supabase.storage.from('failure-photos').getPublicUrl(fileName);
        fotoUrlFinal = data.publicUrl;
      }
    }

    const { error } = await supabase.from('reportes_falla').insert([{ 
      activo_id: activoSeleccionado, 
      descripcion, 
      nivel_urgencia: urgencia,
      foto_url: fotoUrlFinal,
      trabajador_id: session.user.id // Firmado por el obrero
    }]);

    setLoading(false);
    if (!error) {
      alert("¡Reporte enviado con éxito!");
      setDescripcion(''); setActivoSeleccionado(''); setFoto(null);
    }
  };

  // --- 1. Pantalla de Acceso/Registro ---
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <form onSubmit={handleAuth} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100">
          <h2 className="text-2xl font-black mb-6 text-center text-blue-600">Portal Operador</h2>
          {!isLoginMode && (
            <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y Apellido" className="w-full p-3 mb-4 border border-gray-200 rounded-lg bg-gray-50" />
          )}
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo" className="w-full p-3 mb-4 border border-gray-200 rounded-lg bg-gray-50" />
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" className="w-full p-3 mb-6 border border-gray-200 rounded-lg bg-gray-50" />
          
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold p-3 rounded-lg hover:bg-blue-700 transition">
            {loading ? 'Procesando...' : (isLoginMode ? 'Ingresar' : 'Solicitar Acceso')}
          </button>
          
          <p className="mt-4 text-center text-sm text-gray-500 cursor-pointer hover:text-blue-600" onClick={() => setIsLoginMode(!isLoginMode)}>
            {isLoginMode ? '¿Nuevo aquí? Solicita acceso' : '¿Ya tienes cuenta? Ingresa aquí'}
          </p>
          <Link to="/" className="block text-center mt-4 text-gray-400 text-sm hover:underline">Volver</Link>
        </form>
      </div>
    );
  }

  // --- 2. Pantalla de Espera / Revocado ---
  if (perfil?.estado === 'Pendiente') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-yellow-50 p-6 text-center">
        <h2 className="text-3xl font-black text-yellow-600 mb-2">⏳ En Revisión</h2>
        <p className="text-gray-600 mb-6">Tu solicitud fue enviada. Espera a que el supervisor te dé acceso.</p>
        <button onClick={() => supabase.auth.signOut()} className="text-blue-600 font-bold underline">Salir</button>
      </div>
    );
  }

  if (perfil?.estado === 'Revocado') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-6 text-center">
        <h2 className="text-3xl font-black text-red-600 mb-2">🚫 Acceso Denegado</h2>
        <p className="text-gray-600 mb-6">Tus permisos han sido revocados por administración.</p>
        <button onClick={() => supabase.auth.signOut()} className="text-blue-600 font-bold underline">Salir</button>
      </div>
    );
  }

  // --- 3. Pantalla Principal de Reportes (Aprobado) ---
  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-600">📱 Hola, {perfil?.nombre?.split(' ')[0]}</h2>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-red-500 font-bold">Salir</button>
      </div>
      
      <form onSubmit={enviarReporte} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
        <h3 className="text-lg font-black mb-4 text-gray-800">🚨 Reportar Falla</h3>
        <select required value={activoSeleccionado} onChange={(e) => setActivoSeleccionado(e.target.value)} className="w-full p-3 mb-4 bg-gray-50 border border-gray-200 rounded-lg">
          <option value="" disabled>Selecciona máquina...</option>
          {activos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <textarea required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="¿Qué falló?" className="w-full p-3 mb-4 bg-gray-50 border border-gray-200 rounded-lg h-24 resize-none"></textarea>
        
        <label className="block mb-2 text-sm font-semibold text-gray-600">Foto:</label>
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setFoto(e.target.files[0])} className="w-full mb-4 text-sm" />

        <label className="block mb-2 text-sm font-semibold text-gray-600">Urgencia:</label>
        <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)} className="w-full p-3 mb-6 bg-gray-50 border border-gray-200 rounded-lg">
          <option value="Baja">Baja</option>
          <option value="Media">Media</option>
          <option value="Alta">Alta</option>
        </select>
        <button type="submit" disabled={loading} className="w-full p-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Enviando...' : 'Enviar Reporte'}
        </button>
      </form>
    </div>
  );
};

// ==========================================
// 💻 VISTA DEL SUPERVISOR (Con Auditoría y RBAC)
// ==========================================
const PanelMantenimiento = () => {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('Reportes'); // Pestañas: 'Reportes' o 'Personal'
  
  const [reportes, setReportes] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  
  // Filtros de Auditoría
  const [mesFiltro, setMesFiltro] = useState(new Date().getMonth() + 1);
  const [anioFiltro, setAnioFiltro] = useState(new Date().getFullYear());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, []);

  const cargarDatos = async () => {
    const { data: dataRep } = await supabase.from('reportes_falla').select('*, activos(nombre), trabajadores(nombre)').order('creado_en', { ascending: false });
    if (dataRep) setReportes(dataRep);

    const { data: dataTrab } = await supabase.from('trabajadores').select('*').order('creado_en', { ascending: false });
    if (dataTrab) setTrabajadores(dataTrab);
  };

  useEffect(() => {
    if (session) {
      cargarDatos();
      const canal = supabase.channel('cambios-globales')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes_falla' }, cargarDatos)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trabajadores' }, cargarDatos)
        .subscribe();
      return () => supabase.removeChannel(canal);
    }
  }, [session]);

  const cambiarEstadoTrabajador = async (id, nuevoEstado) => {
    await supabase.from('trabajadores').update({ estado: nuevoEstado }).eq('id', id);
    alert(`Trabajador marcado como: ${nuevoEstado}`);
  };

  // Login Básico del Supervisor (Reutilizado)
  if (!session) {
    return <PortalOperador />; // Por brevedad, si no hay sesión, le mostramos el portal de login.
  }

  // --- CÁLCULO DE AUDITORÍA ---
  const estadisticas = trabajadores.filter(t => t.estado === 'Aprobado').map(t => {
    const reportesDelObrero = reportes.filter(r => 
      r.trabajador_id === t.id && 
      new Date(r.creado_en).getMonth() + 1 === parseInt(mesFiltro) &&
      new Date(r.creado_en).getFullYear() === parseInt(anioFiltro)
    );
    return {
      ...t,
      total: reportesDelObrero.length,
      alta: reportesDelObrero.filter(r => r.nivel_urgencia === 'Alta').length,
      media: reportesDelObrero.filter(r => r.nivel_urgencia === 'Media').length,
      baja: reportesDelObrero.filter(r => r.nivel_urgencia === 'Baja').length,
    };
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-black text-gray-800">💻 Centro de Control</h2>
        <button onClick={() => supabase.auth.signOut()} className="px-4 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200 transition">Cerrar Sesión</button>
      </div>

      {/* Navegación de Pestañas */}
      <div className="flex gap-4 mb-8 border-b border-gray-200 pb-2">
        <button onClick={() => setActiveTab('Reportes')} className={`font-bold pb-2 ${activeTab === 'Reportes' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
          🚨 Órdenes de Trabajo
        </button>
        <button onClick={() => setActiveTab('Personal')} className={`font-bold pb-2 ${activeTab === 'Personal' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
          👥 Gestión de Personal y Auditoría
        </button>
      </div>

      {/* --- PESTAÑA: REPORTES --- */}
      {activeTab === 'Reportes' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                <th className="p-4 font-semibold">Máquina/Planta</th>
                <th className="p-4 font-semibold">Falla Reportada</th>
                <th className="p-4 font-semibold text-blue-600">Reportado por</th>
                <th className="p-4 font-semibold">Urgencia</th>
              </tr>
            </thead>
            <tbody>
              {reportes.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-4 font-bold text-gray-800">{r.activos?.nombre}</td>
                  <td className="p-4 text-gray-600">{r.descripcion}</td>
                  <td className="p-4 font-semibold text-blue-800">{r.trabajadores?.nombre || 'Anónimo'}</td>
                  <td className="p-4 text-sm font-bold text-gray-600">{r.nivel_urgencia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- PESTAÑA: PERSONAL Y AUDITORÍA --- */}
      {activeTab === 'Personal' && (
        <div className="space-y-8">
          {/* Solicitudes Nuevas */}
          <div className="bg-white rounded-2xl shadow-sm border border-yellow-200 overflow-hidden">
            <div className="bg-yellow-50 p-4 border-b border-yellow-200"><h3 className="font-bold text-yellow-800">Solicitudes de Acceso Pendientes</h3></div>
            <table className="w-full text-left">
              <tbody>
                {trabajadores.filter(t => t.estado === 'Pendiente').length === 0 && <tr><td className="p-4 text-gray-500 text-center">No hay solicitudes pendientes.</td></tr>}
                {trabajadores.filter(t => t.estado === 'Pendiente').map(t => (
                  <tr key={t.id} className="border-b border-gray-50">
                    <td className="p-4 font-bold">{t.nombre} <br/><span className="text-xs text-gray-400">{t.email}</span></td>
                    <td className="p-4 text-right">
                      <button onClick={() => cambiarEstadoTrabajador(t.id, 'Aprobado')} className="mr-2 px-3 py-1 bg-green-500 text-white font-bold rounded">Aprobar</button>
                      <button onClick={() => cambiarEstadoTrabajador(t.id, 'Revocado')} className="px-3 py-1 bg-red-500 text-white font-bold rounded">Rechazar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tabla de Auditoría Mensual */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">Auditoría de Problemas Reportados</h3>
              <div className="flex gap-2">
                <select value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="p-2 border rounded">
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>Mes {m}</option>)}
                </select>
                <input type="number" value={anioFiltro} onChange={e => setAnioFiltro(e.target.value)} className="p-2 border rounded w-24" />
              </div>
            </div>
            
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-sm border-b border-gray-200">
                  <th className="p-4 text-left font-semibold">Obrero Autorizado</th>
                  <th className="p-4 font-semibold">Total Reportes</th>
                  <th className="p-4 font-semibold text-red-600">Alta Urgencia</th>
                  <th className="p-4 font-semibold text-yellow-600">Media</th>
                  <th className="p-4 font-semibold text-green-600">Baja</th>
                  <th className="p-4 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {estadisticas.map((est) => (
                  <tr key={est.id} className="border-b border-gray-50">
                    <td className="p-4 font-bold text-left">{est.nombre}</td>
                    <td className="p-4 font-black text-lg">{est.total}</td>
                    <td className="p-4 text-red-600 font-bold">{est.alta}</td>
                    <td className="p-4 text-yellow-600">{est.media}</td>
                    <td className="p-4 text-green-600">{est.baja}</td>
                    <td className="p-4">
                      <button onClick={() => cambiarEstadoTrabajador(est.id, 'Revocado')} className="text-xs text-red-500 font-bold border border-red-500 px-2 py-1 rounded hover:bg-red-50">
                        Revocar Acceso
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const Home = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
    <h1 className="text-5xl font-black mb-4 text-center text-slate-800 tracking-tight">Maqui<span className="text-blue-600">Track</span></h1>
    <div className="flex gap-4">
      <Link to="/operador" className="px-6 py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700">📱 Acceso Operador</Link>
      <Link to="/panel" className="px-6 py-4 bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:bg-slate-900">💻 Panel Supervisor</Link>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/operador" element={<PortalOperador />} />
        <Route path="/panel" element={<PanelMantenimiento />} />
      </Routes>
    </Router>
  );
}

export default App;