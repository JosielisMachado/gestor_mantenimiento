import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

const PortalOperador = () => {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [activos, setActivos] = useState([]);
  
  const [activoSeleccionado, setActivoSeleccionado] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [urgencia, setUrgencia] = useState('Media');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const cargarActivos = async () => {
      const { data, error } = await supabase.from('activos').select('*');
      if (!error && data) setActivos(data);
    };
    cargarActivos();
  }, []);

  const enviarReporte = async (e) => {
    e.preventDefault();
    setEnviando(true);

    const { error } = await supabase
      .from('reportes_falla')
      .insert([{ activo_id: activoSeleccionado, descripcion, nivel_urgencia: urgencia }]);

    setEnviando(false);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("¡Reporte enviado con éxito!");
      setDescripcion('');
      setActivoSeleccionado('');
      setMostrarFormulario(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-blue-600 mb-6">📱 Portal del Operador</h2>
      
      {!mostrarFormulario ? (
        <>
          <button 
            onClick={() => setMostrarFormulario(true)}
            className="bg-red-500 text-white font-bold p-4 rounded-xl w-full mb-4 shadow-md hover:bg-red-600 transition">
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
            {activos.map(activo => <option key={activo.id} value={activo.id}>{activo.nombre}</option>)}
          </select>

          <label className="block mb-2 text-sm font-semibold text-gray-600">¿Qué falló?</label>
          <textarea required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Manguera hidráulica rota..." className="w-full p-3 mb-4 bg-gray-50 border border-gray-200 rounded-lg h-24 resize-none"></textarea>

          <label className="block mb-2 text-sm font-semibold text-gray-600">Nivel de Urgencia:</label>
          <select value={urgencia} onChange={(e) => setUrgencia(e.target.value)} className="w-full p-3 mb-6 bg-gray-50 border border-gray-200 rounded-lg">
            <option value="Baja">Baja (Puede seguir operando)</option>
            <option value="Media">Media (Revisar pronto)</option>
            <option value="Alta">Alta (Equipo detenido)</option>
          </select>

          <div className="flex gap-2">
            <button type="button" onClick={() => setMostrarFormulario(false)} className="flex-1 p-3 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300">Cancelar</button>
            <button type="submit" disabled={enviando} className="flex-1 p-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {enviando ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

const PanelMantenimiento = () => {
  const [reportes, setReportes] = useState([]);

  // Función separada para poder llamarla al inicio y cuando haya cambios
  const cargarReportes = async () => {
    const { data, error } = await supabase
      .from('reportes_falla')
      .select('id, descripcion, nivel_urgencia, estado_resolucion, creado_en, activos(nombre)')
      .order('creado_en', { ascending: false });

    if (!error && data) setReportes(data);
  };

  useEffect(() => {
    cargarReportes(); // Carga inicial

    // Nos suscribimos a los cambios en la tabla 'reportes_falla'
    const canalSuscripcion = supabase
      .channel('cambios-reportes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reportes_falla' }, (payload) => {
        console.log('¡Cambio detectado en base de datos!', payload);
        cargarReportes(); // Recargamos la tabla automáticamente
      })
      .subscribe();

    // Limpieza al salir de la pantalla
    return () => {
      supabase.removeChannel(canalSuscripcion);
    };
  }, []);

  // Función para marcar como Resuelto
  const marcarComoResuelto = async (id) => {
    const { error } = await supabase
      .from('reportes_falla')
      .update({ estado_resolucion: 'Resuelto' })
      .eq('id', id);

    if (error) {
      alert("Error al actualizar: " + error.message);
    }
    // No necesitamos actualizar el estado 'reportes' a mano aquí, 
    // porque nuestro canal de 'Realtime' detectará el cambio y recargará la tabla sola. 😎
  };

  const getColorUrgencia = (nivel) => {
    if (nivel === 'Alta') return 'bg-red-100 text-red-700 border-red-200';
    if (nivel === 'Media') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  const getColorEstado = (estado) => {
    if (estado === 'Resuelto') return 'bg-green-50 text-green-600 border-green-200';
    if (estado === 'En progreso') return 'bg-blue-50 text-blue-600 border-blue-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  // Contadores dinámicos
  const reportesPendientes = reportes.filter(r => r.estado_resolucion !== 'Resuelto').length;
  const reportesResueltos = reportes.filter(r => r.estado_resolucion === 'Resuelto').length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black text-gray-800">💻 Panel de Supervisor</h2>
        <Link to="/" className="text-blue-600 font-bold hover:underline">Volver al Inicio</Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 shadow-sm rounded-2xl border border-gray-100 border-l-4 border-l-red-500">
          <p className="text-gray-500 text-sm font-semibold mb-1">Pendientes / Parados</p>
          <p className="text-3xl font-black text-gray-800">{reportesPendientes}</p>
        </div>
        <div className="bg-white p-6 shadow-sm rounded-2xl border border-gray-100 border-l-4 border-l-green-500">
          <p className="text-gray-500 text-sm font-semibold mb-1">Fallas Resueltas</p>
          <p className="text-3xl font-black text-gray-800">{reportesResueltos}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h3 className="text-xl font-bold text-gray-800">Órdenes de Trabajo</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm border-b border-gray-100">
                <th className="p-4 font-semibold">Máquina/Planta</th>
                <th className="p-4 font-semibold">Falla Reportada</th>
                <th className="p-4 font-semibold">Urgencia</th>
                <th className="p-4 font-semibold">Estado</th>
                <th className="p-4 font-semibold text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {reportes.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">No hay reportes de fallas activos.</td>
                </tr>
              ) : (
                reportes.map((reporte) => (
                  <tr key={reporte.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="p-4 font-bold text-gray-800">{reporte.activos?.nombre || 'Desconocido'}</td>
                    <td className="p-4 text-gray-600">{reporte.descripcion}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getColorUrgencia(reporte.nivel_urgencia)}`}>
                        {reporte.nivel_urgencia}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getColorEstado(reporte.estado_resolucion)}`}>
                        {reporte.estado_resolucion}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {reporte.estado_resolucion !== 'Resuelto' ? (
                        <button 
                          onClick={() => marcarComoResuelto(reporte.id)}
                          className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition shadow-sm"
                        >
                          ✔ Marcar Resuelto
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm font-semibold">Completado</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Home = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
    <h1 className="text-5xl font-black mb-4 text-center text-slate-800 tracking-tight">Maqui<span className="text-blue-600">Track</span></h1>
    <p className="text-slate-500 mb-12 text-center max-w-md text-lg">Sistema centralizado de gestión de mantenimiento para flota pesada y plantas fijas.</p>
    
    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
      <Link to="/operador" className="flex-1 text-center px-6 py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-xl transition transform hover:-translate-y-1">
        📱 Vista Operador (Móvil)
      </Link>
      <Link to="/panel" className="flex-1 text-center px-6 py-4 bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:bg-slate-900 hover:shadow-xl transition transform hover:-translate-y-1">
        💻 Vista Supervisor (PC)
      </Link>
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