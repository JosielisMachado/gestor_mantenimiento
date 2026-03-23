import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

// ==========================================
// 📱 VISTA DEL OPERADOR (Terreno)
// ==========================================
const PortalOperador = () => {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [activos, setActivos] = useState([]);
  
  const [activoSeleccionado, setActivoSeleccionado] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [urgencia, setUrgencia] = useState('Media');
  const [foto, setFoto] = useState(null); // Nuevo estado para la foto
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const cargarActivos = async () => {
      const { data } = await supabase.from('activos').select('*');
      if (data) setActivos(data);
    };
    cargarActivos();
  }, []);

  const enviarReporte = async (e) => {
    e.preventDefault();
    setEnviando(true);

    let fotoUrlFinal = null;

    // 1. Si el operador tomó una foto, la subimos primero al Storage
    if (foto) {
      const fileExt = foto.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`; // Nombre único con la fecha
      
      const { error: uploadError } = await supabase.storage
        .from('failure-photos') // ¡Usando la carpeta que ya tenías!
        .upload(fileName, foto);

      if (!uploadError) {
        // Obtenemos el link público de la foto recién subida
        const { data } = supabase.storage.from('failure-photos').getPublicUrl(fileName);
        fotoUrlFinal = data.publicUrl;
      } else {
        alert("Hubo un problema subiendo la foto, pero enviaremos el texto.");
      }
    }

    // 2. Guardamos todo el texto + el link de la foto en la base de datos
    const { error } = await supabase
      .from('reportes_falla')
      .insert([{ 
        activo_id: activoSeleccionado, 
        descripcion, 
        nivel_urgencia: urgencia,
        foto_url: fotoUrlFinal // Guardamos la URL
      }]);

    setEnviando(false);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("¡Reporte y foto enviados con éxito a la base principal!");
      setDescripcion('');
      setActivoSeleccionado('');
      setFoto(null);
      setMostrarFormulario(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-blue-600 mb-6">📱 Portal del Operador</h2>
      
      {!mostrarFormulario ? (
        <>
          <button onClick={() => setMostrarFormulario(true)} className="bg-red-500 text-white font-bold p-4 rounded-xl w-full mb-4 shadow-md hover:bg-red-600 transition">
            🚨 Reportar Falla Urgente
          </button>
          <button className="bg-green-500 text-white font-bold p-4 rounded-xl w-full shadow-md hover:bg-green-600 transition">
            ✅ Checklist Pre-operacional
          </button>
        </>
      ) : (
        <form onSubmit={enviarReporte} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <h3 className="text-lg font-black mb-4 text-gray-800">Nuevo Reporte</h3>
          
          <label className="block mb-2 text-sm font-semibold text-gray-600">Máquina / Planta:</label>
          <select required value={activoSeleccionado} onChange={(e) => setActivoSeleccionado(e.target.value)} className="w-full p-3 mb-4 bg-gray-50 border border-gray-200 rounded-lg">
            <option value="" disabled>Selecciona el equipo...</option>
            {activos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>

          <label className="block mb-2 text-sm font-semibold text-gray-600">¿Qué falló?</label>
          <textarea required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Manguera hidráulica rota..." className="w-full p-3 mb-4 bg-gray-50 border border-gray-200 rounded-lg h-24 resize-none"></textarea>

          {/* NUEVO: Botón de Cámara */}
          <label className="block mb-2 text-sm font-semibold text-gray-600">Evidencia Fotográfica:</label>
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" // Esto fuerza a abrir la cámara en el celular
            onChange={(e) => setFoto(e.target.files[0])}
            className="w-full p-2 mb-4 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />

          <label className="block mb-2 text-sm font-semibold text-gray-600">Nivel de Urgencia:</label>
          <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)} className="w-full p-3 mb-6 bg-gray-50 border border-gray-200 rounded-lg">
            <option value="Baja">Baja</option>
            <option value="Media">Media</option>
            <option value="Alta">Alta</option>
          </select>

          <div className="flex gap-2">
            <button type="button" onClick={() => setMostrarFormulario(false)} className="flex-1 p-3 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" disabled={enviando} className="flex-1 p-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {enviando ? 'Subiendo...' : 'Enviar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

// ==========================================
// 💻 VISTA DEL SUPERVISOR (Con Login Privado)
// ==========================================
const PanelMantenimiento = () => {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportes, setReportes] = useState([]);
  const navigate = useNavigate();

  // Verifica si el usuario ya inició sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Error de acceso: " + error.message);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // Cargar reportes en tiempo real SOLO si hay sesión iniciada
  useEffect(() => {
    if (!session) return;

    const cargarReportes = async () => {
      const { data } = await supabase.from('reportes_falla').select('id, descripcion, nivel_urgencia, estado_resolucion, creado_en, foto_url, activos(nombre)').order('creado_en', { ascending: false });
      if (data) setReportes(data);
    };

    cargarReportes();

    const canalSuscripcion = supabase.channel('cambios-reportes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes_falla' }, () => cargarReportes())
      .subscribe();

    return () => supabase.removeChannel(canalSuscripcion);
  }, [session]);

  const marcarComoResuelto = async (id) => {
    await supabase.from('reportes_falla').update({ estado_resolucion: 'Resuelto' }).eq('id', id);
  };

  // --- PANTALLA DE LOGIN ---
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100">
          <h2 className="text-2xl font-black mb-6 text-center text-gray-800">Acceso Supervisor</h2>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico" className="w-full p-3 mb-4 border border-gray-200 rounded-lg bg-gray-50" />
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" className="w-full p-3 mb-6 border border-gray-200 rounded-lg bg-gray-50" />
          <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white font-bold p-3 rounded-lg hover:bg-slate-900 transition">
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
          <Link to="/" className="block text-center mt-4 text-blue-600 text-sm hover:underline">Volver al inicio</Link>
        </form>
      </div>
    );
  }

  // --- PANTALLA DEL PANEL (Privada) ---
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-gray-800">💻 Centro de Control</h2>
        <button onClick={handleLogout} className="px-4 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200 transition">Cerrar Sesión</button>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                <th className="p-4 font-semibold">Máquina/Planta</th>
                <th className="p-4 font-semibold">Falla Reportada</th>
                <th className="p-4 font-semibold text-center">Foto</th>
                <th className="p-4 font-semibold">Urgencia</th>
                <th className="p-4 font-semibold text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {reportes.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="p-4 font-bold text-gray-800">{r.activos?.nombre}</td>
                  <td className="p-4 text-gray-600">{r.descripcion}</td>
                  <td className="p-4 text-center">
                    {/* NUEVO: Mostrar la foto miniatura si existe */}
                    {r.foto_url ? (
                      <a href={r.foto_url} target="_blank" rel="noreferrer">
                        <img src={r.foto_url} alt="Falla" className="w-12 h-12 object-cover rounded-lg border border-gray-200 mx-auto hover:scale-150 transition-transform cursor-pointer" title="Clic para ampliar" />
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">Sin foto</span>
                    )}
                  </td>
                  <td className="p-4 text-sm font-bold text-gray-600">{r.nivel_urgencia}</td>
                  <td className="p-4 text-center">
                    {r.estado_resolucion !== 'Resuelto' ? (
                      <button onClick={() => marcarComoResuelto(r.id)} className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">✔ Resolver</button>
                    ) : (
                      <span className="text-green-500 text-sm font-bold">Resuelto</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 🏠 INICIO
// ==========================================
const Home = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
    <h1 className="text-5xl font-black mb-4 text-center text-slate-800 tracking-tight">Maqui<span className="text-blue-600">Track</span></h1>
    <p className="text-slate-500 mb-12 text-center max-w-md text-lg">Sistema centralizado de gestión de mantenimiento.</p>
    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
      <Link to="/operador" className="flex-1 text-center px-6 py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-xl transition transform hover:-translate-y-1">📱 Ingreso Operador</Link>
      <Link to="/panel" className="flex-1 text-center px-6 py-4 bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:bg-slate-900 hover:shadow-xl transition transform hover:-translate-y-1">💻 Ingreso Supervisor</Link>
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