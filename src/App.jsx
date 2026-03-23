import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

// ==========================================
// 📱 VISTA DEL OPERADOR (Terreno)
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
        <p className="text-gray-600 mb-6">Tu cuenta está esperando aprobación del supervisor.</p>
        <button onClick={() => supabase.auth.signOut()} className="text-blue-600 font-bold underline">Cerrar Sesión</button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-600 tracking-tight">📱 MaquiTrack</h2>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-red-500 font-bold">Salir</button>
      </div>
      
      <form onSubmit={enviarReporte} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
        <h3 className="text-lg font-black mb-4 text-gray-800">🚨 Reportar Falla</h3>
        <select required value={activoSeleccionado} onChange={(e) => setActivoSeleccionado(e.target.value)} className="w-full p-3 mb-4 bg-gray-50 border border-gray-200 rounded-lg">
          <option value="" disabled>Selecciona máquina...</option>
          {activos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <textarea required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="¿Qué falló?" className="w-full p-3 mb-4 bg-gray-50 border border-gray-200 rounded-lg h-24 resize-none"></textarea>
        
        <label className="block mb-2 text-sm font-semibold text-gray-600">Evidencia (Cámara):</label>
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setFoto(e.target.files[0])} className="w-full mb-4 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700" />

        <label className="block mb-2 text-sm font-semibold text-gray-600">Urgencia:</label>
        <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)} className="w-full p-3 mb-6 bg-gray-50 border border-gray-200 rounded-lg">
          <option value="Baja">Baja (Mantenimiento)</option>
          <option value="Media">Media (Pronta revisión)</option>
          <option value="Alta">Alta (Equipo detenido)</option>
        </select>
        <button type="submit" disabled={loading} className="w-full p-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition shadow-lg">
          {loading ? 'Subiendo datos...' : 'Enviar Reporte a Base'}
        </button>
      </form>
    </div>
  );
};

// ==========================================
// 💻 VISTA DEL SUPERVISOR (Centro de Control)
// ==========================================
const PanelMantenimiento = () => {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('Reportes'); 
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  
  const [reportes, setReportes] = useState([]);
  const [trabajadores, setTrabajadores] = useState([]);
  const [activos, setActivos] = useState([]);
  
  const [nuevoActivo, setNuevoActivo] = useState({ nombre: '', categoria: 'Flota móvil', estado: 'Operativo', horometro_km: 0, fecha_mantenimiento: '' });
  const [editandoId, setEditandoId] = useState(null);

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
      const canal = supabase.channel('cambios-reales')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes_falla' }, cargarDatos)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trabajadores' }, cargarDatos)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'activos' }, cargarDatos)
        .subscribe();
      return () => supabase.removeChannel(canal);
    }
  }, [session]);

  const eliminarActivo = async (id) => {
    if (window.confirm("¿Confirmas eliminar este equipo del inventario en la nube?")) {
      await supabase.from('activos').delete().eq('id', id);
    }
  };

  const actualizarActivo = async (id, datos) => {
    await supabase.from('activos').update(datos).eq('id', id);
    setEditandoId(null);
  };

  const agregarActivo = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('activos').insert([nuevoActivo]);
    if (!error) {
      setNuevoActivo({ nombre: '', categoria: 'Flota móvil', estado: 'Operativo', horometro_km: 0, fecha_mantenimiento: '' });
      setSidebarAbierto(false);
    }
  };

  if (!session) return <PortalOperador />;

  const estadisticas = trabajadores.filter(t => t.estado === 'Aprobado').map(t => {
    const rep = reportes.filter(r => r.trabajador_id === t.id && new Date(r.creado_en).getMonth() + 1 === parseInt(mesFiltro) && new Date(r.creado_en).getFullYear() === parseInt(anioFiltro));
    return { ...t, total: rep.length, alta: rep.filter(r => r.nivel_urgencia === 'Alta').length, media: rep.filter(r => r.nivel_urgencia === 'Media').length, baja: rep.filter(r => r.nivel_urgencia === 'Baja').length };
  });

  return (
    <div className="p-8 max-w-7xl mx-auto relative min-h-screen">
      
      {/* SIDEBAR DESLIZANTE PARA NUEVO EQUIPO */}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out p-6 border-l ${sidebarAbierto ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-black">Nuevo Equipo</h3>
          <button onClick={() => setSidebarAbierto(false)} className="text-3xl text-gray-300 hover:text-red-500">×</button>
        </div>
        <form onSubmit={agregarActivo} className="space-y-4">
          <input required placeholder="Nombre" value={nuevoActivo.nombre} onChange={e => setNuevoActivo({...nuevoActivo, nombre: e.target.value})} className="w-full p-3 border rounded-lg bg-gray-50"/>
          <select value={nuevoActivo.categoria} onChange={e => setNuevoActivo({...nuevoActivo, categoria: e.target.value})} className="w-full p-3 border rounded-lg">
            <option value="Flota móvil">Flota móvil</option>
            <option value="Planta fija">Planta fija</option>
            <option value="Equipo portátil">Equipo portátil</option>
          </select>
          <input type="date" value={nuevoActivo.fecha_mantenimiento} onChange={e => setNuevoActivo({...nuevoActivo, fecha_mantenimiento: e.target.value})} className="w-full p-3 border rounded-lg"/>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl">Guardar Activo</button>
        </form>
      </div>

      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Centro de Control 🖥️</h2>
        <button onClick={() => supabase.auth.signOut()} className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 transition">Cerrar Sesión</button>
      </div>

      <div className="flex gap-6 mb-8 border-b border-gray-100 overflow-x-auto">
        {['Reportes', 'Inventario', 'Personal'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 font-bold transition-all ${activeTab === tab ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-400'}`}>
            {tab === 'Reportes' ? '🚨 Órdenes' : tab === 'Inventario' ? '🚜 Inventario' : '👥 Personal'}
          </button>
        ))}
      </div>

      {/* --- PESTAÑA INVENTARIO --- */}
      {activeTab === 'Inventario' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setSidebarAbierto(true)} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-slate-900 transition shadow-lg">+ Nuevo Equipo</button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                <tr><th className="p-4">Equipo</th><th className="p-4">Mant. Prox.</th><th className="p-4">KM/Horas</th><th className="p-4 text-center">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activos.map(a => (
                  <tr key={a.id} className="hover:bg-blue-50/30 transition">
                    <td className="p-4">
                      {editandoId === a.id ? <input className="border rounded p-1" value={a.nombre} onChange={e => setActivos(activos.map(i => i.id === a.id ? {...i, nombre: e.target.value} : i))}/> : <span className="font-bold">{a.nombre}</span>}
                    </td>
                    <td className="p-4">
                      {editandoId === a.id ? <input type="date" className="border rounded p-1" value={a.fecha_mantenimiento || ''} onChange={e => setActivos(activos.map(i => i.id === a.id ? {...i, fecha_mantenimiento: e.target.value} : i))}/> : <span className="text-blue-600 text-sm font-semibold">{a.fecha_mantenimiento || 'Sin programar'}</span>}
                    </td>
                    <td className="p-4 font-mono">
                      {editandoId === a.id ? <input type="number" className="border rounded p-1 w-24" value={a.horometro_km} onChange={e => setActivos(activos.map(i => i.id === a.id ? {...i, horometro_km: e.target.value} : i))}/> : a.horometro_km}
                    </td>
                    <td className="p-4 flex justify-center gap-4">
                      {editandoId === a.id ? <button onClick={() => actualizarActivo(a.id, a)} className="text-green-600 font-bold">Guardar</button> : <button onClick={() => setEditandoId(a.id)} className="text-blue-600 font-bold">Editar</button>}
                      <button onClick={() => eliminarActivo(a.id)} className="text-red-400 font-bold">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- PESTAÑA REPORTES --- */}
      {activeTab === 'Reportes' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase">
              <tr><th className="p-4">Equipo</th><th className="p-4">Falla</th><th className="p-4 text-center">Foto</th><th className="p-4">Reportado por</th><th className="p-4">Acción</th></tr>
            </thead>
            <tbody>
              {reportes.map(r => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="p-4 font-bold">{r.activos?.nombre}</td>
                  <td className="p-4 text-gray-600 text-sm">{r.descripcion}</td>
                  <td className="p-4 text-center">{r.foto_url ? <a href={r.foto_url} target="_blank" rel="noreferrer"><img src={r.foto_url} className="w-10 h-10 object-cover rounded mx-auto border" alt="falla"/></a> : '-'}</td>
                  <td className="p-4 text-blue-800 text-sm font-semibold">{r.trabajadores?.nombre}</td>
                  <td className="p-4">
                    {r.estado_resolucion !== 'Resuelto' ? <button onClick={() => supabase.from('reportes_falla').update({estado_resolucion: 'Resuelto'}).eq('id', r.id)} className="bg-green-500 text-white px-3 py-1 rounded text-xs font-bold">Resolver</button> : '✅'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- PESTAÑA PERSONAL (AUDITORÍA) --- */}
      {activeTab === 'Personal' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Métricas por Trabajador</h3>
              <div className="flex gap-2">
                <select value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} className="p-2 border rounded">
                  {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>Mes {i+1}</option>)}
                </select>
                <input type="number" value={anioFiltro} onChange={e => setAnioFiltro(e.target.value)} className="p-2 border rounded w-24"/>
              </div>
            </div>
            <table className="w-full text-center">
              <thead className="bg-gray-50">
                <tr><th className="p-3 text-left">Nombre</th><th>Total Reportes</th><th className="text-red-600">Alta Urgencia</th><th>Acción</th></tr>
              </thead>
              <tbody>
                {estadisticas.map(est => (
                  <tr key={est.id} className="border-b border-gray-50">
                    <td className="p-3 text-left font-bold">{est.nombre}</td>
                    <td className="p-3 font-black text-xl">{est.total}</td>
                    <td className="p-3 text-red-600 font-bold">{est.alta}</td>
                    <td className="p-3"><button onClick={() => supabase.from('trabajadores').update({estado: 'Revocado'}).eq('id', est.id)} className="text-xs text-red-400 font-bold border border-red-200 px-2 py-1 rounded">Revocar</button></td>
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
    <h1 className="text-5xl font-black mb-12 text-slate-800 tracking-tight">Maqui<span className="text-blue-600">Track</span></h1>
    <div className="flex gap-6 w-full max-w-md">
      <Link to="/operador" className="flex-1 text-center py-5 bg-blue-600 text-white font-bold rounded-2xl shadow-xl hover:bg-blue-700 transition transform hover:-translate-y-1">📱 Operador</Link>
      <Link to="/panel" className="flex-1 text-center py-5 bg-slate-800 text-white font-bold rounded-2xl shadow-xl hover:bg-slate-900 transition transform hover:-translate-y-1">💻 Supervisor</Link>
    </div>
  </div>
);

function App() { return ( <Router><Routes><Route path="/" element={<Home />} /><Route path="/operador" element={<PortalOperador />} /><Route path="/panel" element={<PanelMantenimiento />} /></Routes></Router> ); }

export default App;