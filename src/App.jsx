import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

// ==========================================
// 📱 VISTA DEL OPERADOR
// ==========================================
const PortalOperador = () => {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);

  const [activos, setActivos] = useState([]);
  const [activoSeleccionado, setActivoSeleccionado] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [urgencia, setUrgencia] = useState('Media');
  const [foto, setFoto] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

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
      trabajador_id: session.user.id
    }]);

    setLoading(false);
    if (!error) {
      alert("¡Reporte enviado con éxito!");
      setDescripcion(''); setActivoSeleccionado(''); setFoto(null);
    }
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <form onSubmit={handleAuth} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100">
          <h2 className="text-2xl font-black mb-6 text-center text-blue-600">Portal Operador</h2>
          {!isLoginMode && <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y Apellido" className="w-full p-3 mb-4 border border-gray-200 rounded-lg bg-gray-50" />}
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

  if (perfil?.estado === 'Pendiente') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-yellow-50 p-6 text-center">
        <h2 className="text-3xl font-black text-yellow-600 mb-2">⏳ En Revisión</h2>
        <p className="text-gray-600 mb-6">Espera a que el supervisor te dé acceso.</p>
        <button onClick={() => supabase.auth.signOut()} className="text-blue-600 font-bold underline">Salir</button>
      </div>
    );
  }

  if (perfil?.estado === 'Revocado') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-6 text-center">
        <h2 className="text-3xl font-black text-red-600 mb-2">🚫 Acceso Denegado</h2>
        <p className="text-gray-600 mb-6">Tus permisos han sido revocados.</p>
        <button onClick={() => supabase.auth.signOut()} className="text-blue-600 font-bold underline">Salir</button>
      </div>
    );
  }

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
// 💻 VISTA DEL SUPERVISOR 
// ==========================================
const PanelMantenimiento = () => {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('Reportes'); 
  
  const [reportes, setReportes] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [activos, setActivos] = useState([]);
  
  // Estados para nuevo activo
  const [nuevoActivo, setNuevoActivo] = useState({ nombre: '', categoria: 'Flota móvil', estado: 'Operativo', horometro_km: 0 });

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

    const { data: dataAct } = await supabase.from('activos').select('*').order('creado_en', { ascending: false });
    if (dataAct) setActivos(dataAct);
  };

  useEffect(() => {
    if (session) {
      cargarDatos();
      const canal = supabase.channel('cambios-globales')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes_falla' }, cargarDatos)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trabajadores' }, cargarDatos)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'activos' }, cargarDatos)
        .subscribe();
      return () => supabase.removeChannel(canal);
    }
  }, [session]);

  const cambiarEstadoTrabajador = async (id, nuevoEstado) => {
    await supabase.from('trabajadores').update({ estado: nuevoEstado }).eq('id', id);
  };

  const marcarComoResuelto = async (id) => {
    await supabase.from('reportes_falla').update({ estado_resolucion: 'Resuelto' }).eq('id', id);
  };

  const agregarActivo = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('activos').insert([nuevoActivo]);
    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      alert("¡Activo agregado al inventario!");
      setNuevoActivo({ nombre: '', categoria: 'Flota móvil', estado: 'Operativo', horometro_km: 0 });
    }
  };

  if (!session) {
    return <PortalOperador />; 
  }

  const estadisticas = trabajadores.filter(t => t.estado === 'Aprobado').map(t => {
    const rep = reportes.filter(r => r.trabajador_id === t.id && new Date(r.creado_en).getMonth() + 1 === parseInt(mesFiltro) && new Date(r.creado_en).getFullYear() === parseInt(anioFiltro));
    return { ...t, total: rep.length, alta: rep.filter(r => r.nivel_urgencia === 'Alta').length, media: rep.filter(r => r.nivel_urgencia === 'Media').length, baja: rep.filter(r => r.nivel_urgencia === 'Baja').length };
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-black text-gray-800">💻 Centro de Control</h2>
        <button onClick={() => supabase.auth.signOut()} className="px-4 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200 transition">Cerrar Sesión</button>
      </div>

      <div className="flex gap-4 mb-8 border-b border-gray-200 pb-2 overflow-x-auto">
        <button onClick={() => setActiveTab('Reportes')} className={`font-bold pb-2 whitespace-nowrap ${activeTab === 'Reportes' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>🚨 Órdenes de Trabajo</button>
        <button onClick={() => setActiveTab('Inventario')} className={`font-bold pb-2 whitespace-nowrap ${activeTab === 'Inventario' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>🚜 Inventario de Activos</button>
        <button onClick={() => setActiveTab('Personal')} className={`font-bold pb-2 whitespace-nowrap ${activeTab === 'Personal' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>👥 Personal y Auditoría</button>
      </div>

      {/* --- PESTAÑA: REPORTES (FOTOS RESTAURADAS) --- */}
      {activeTab === 'Reportes' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                  <th className="p-4 font-semibold">Máquina/Planta</th>
                  <th className="p-4 font-semibold">Falla Reportada</th>
                  <th className="p-4 font-semibold text-center">Foto</th>
                  <th className="p-4 font-semibold text-blue-600">Reportado por</th>
                  <th className="p-4 font-semibold">Urgencia</th>
                  <th className="p-4 font-semibold text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {reportes.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="p-4 font-bold text-gray-800">{r.activos?.nombre}</td>
                    <td className="p-4 text-gray-600">{r.descripcion}</td>
                    
                    {/* COLUMNA DE FOTO RESTAURADA */}
                    <td className="p-4 text-center">
                      {r.foto_url ? (
                        <a href={r.foto_url} target="_blank" rel="noreferrer">
                          <img src={r.foto_url} alt="Falla" className="w-12 h-12 object-cover rounded-lg border border-gray-200 mx-auto hover:scale-150 transition-transform cursor-pointer" title="Ver imagen completa"/>
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">Sin foto</span>
                      )}
                    </td>

                    <td className="p-4 font-semibold text-blue-800">{r.trabajadores?.nombre || 'Anónimo'}</td>
                    <td className="p-4 text-sm font-bold text-gray-600">{r.nivel_urgencia}</td>
                    
                    {/* BOTÓN DE RESOLVER RESTAURADO */}
                    <td className="p-4 text-center">
                      {r.estado_resolucion !== 'Resuelto' ? (
                        <button onClick={() => marcarComoResuelto(r.id)} className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 shadow-sm">✔ Resolver</button>
                      ) : (
                        <span className="text-green-600 text-sm font-bold bg-green-50 px-2 py-1 rounded">Resuelto</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- PESTAÑA: INVENTARIO DE ACTIVOS (NUEVA) --- */}
      {activeTab === 'Inventario' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Formulario Agregar Activo */}
          <div className="md:col-span-1">
            <form onSubmit={agregarActivo} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-black mb-4 text-gray-800">➕ Nuevo Equipo</h3>
              <input required type="text" placeholder="Ej: Camión Volvo FMX" value={nuevoActivo.nombre} onChange={e => setNuevoActivo({...nuevoActivo, nombre: e.target.value})} className="w-full p-2 mb-3 border rounded bg-gray-50"/>
              
              <label className="text-xs font-bold text-gray-500">Categoría</label>
              <select value={nuevoActivo.categoria} onChange={e => setNuevoActivo({...nuevoActivo, categoria: e.target.value})} className="w-full p-2 mb-3 border rounded bg-gray-50">
                <option value="Flota móvil">Flota móvil</option>
                <option value="Equipo portátil">Equipo portátil</option>
                <option value="Planta fija">Planta fija</option>
              </select>

              <label className="text-xs font-bold text-gray-500">Estado Inicial</label>
              <select value={nuevoActivo.estado} onChange={e => setNuevoActivo({...nuevoActivo, estado: e.target.value})} className="w-full p-2 mb-3 border rounded bg-gray-50">
                <option value="Operativo">Operativo</option>
                <option value="En mantenimiento">En mantenimiento</option>
                <option value="Descontinuado">Descontinuado</option>
              </select>

              <label className="text-xs font-bold text-gray-500">Horómetro / KM Actuales</label>
              <input required type="number" value={nuevoActivo.horometro_km} onChange={e => setNuevoActivo({...nuevoActivo, horometro_km: e.target.value})} className="w-full p-2 mb-4 border rounded bg-gray-50"/>

              <button type="submit" className="w-full bg-slate-800 text-white font-bold py-2 rounded hover:bg-slate-900">Guardar Activo</button>
            </form>
          </div>

          {/* Tabla de Activos */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                    <th className="p-4 font-semibold">Equipo/Planta</th>
                    <th className="p-4 font-semibold">Categoría</th>
                    <th className="p-4 font-semibold">Horas/KM</th>
                    <th className="p-4 font-semibold text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {activos.map(a => (
                    <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-4 font-bold text-gray-800">{a.nombre}</td>
                      <td className="p-4 text-sm text-gray-600">{a.categoria}</td>
                      <td className="p-4 text-sm text-gray-600 font-mono">{a.horometro_km}</td>
                      <td className="p-4 text-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${a.estado === 'Operativo' ? 'bg-green-100 text-green-700' : a.estado === 'En mantenimiento' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {a.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- PESTAÑA: PERSONAL Y AUDITORÍA --- */}
      {activeTab === 'Personal' && (
        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-yellow-200 overflow-hidden">
            <div className="bg-yellow-50 p-4 border-b border-yellow-200"><h3 className="font-bold text-yellow-800">Solicitudes Pendientes</h3></div>
            <table className="w-full text-left">
              <tbody>
                {trabajadores.filter(t => t.estado === 'Pendiente').length === 0 && <tr><td className="p-4 text-gray-500 text-center">Sin solicitudes.</td></tr>}
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

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">Auditoría de Problemas</h3>
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
                  <th className="p-4 text-left font-semibold">Obrero</th>
                  <th className="p-4 font-semibold">Total</th>
                  <th className="p-4 font-semibold text-red-600">Alta</th>
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
                      <button onClick={() => cambiarEstadoTrabajador(est.id, 'Revocado')} className="text-xs text-red-500 font-bold border border-red-500 px-2 py-1 rounded hover:bg-red-50">Revocar Acceso</button>
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