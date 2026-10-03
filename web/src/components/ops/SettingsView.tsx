import { User, Bell, Shield, Sliders } from 'lucide-react'

export function SettingsView() {
  return (
    <div className="p-6 h-full flex flex-col gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Platform configuration and preferences</p>
        </div>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden">
        
        {/* Settings Navigation */}
        <div className="w-64 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2 shrink-0">
          <button className="flex items-center gap-3 w-full p-3 rounded-xl bg-slate-50 text-blue-600 font-semibold text-sm transition-colors text-left">
            <Sliders size={18} /> General
          </button>
          <button className="flex items-center gap-3 w-full p-3 rounded-xl text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors text-left">
            <User size={18} /> Account
          </button>
          <button className="flex items-center gap-3 w-full p-3 rounded-xl text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors text-left">
            <Bell size={18} /> Notifications
          </button>
          <button className="flex items-center gap-3 w-full p-3 rounded-xl text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors text-left">
            <Shield size={18} /> Security
          </button>
        </div>

        {/* Settings Content */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-8 overflow-y-auto">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Sliders className="text-blue-500" size={24} />
            General Configuration
          </h2>
          
          <div className="space-y-6 max-w-2xl">
            
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 border-b border-slate-100 pb-2">Hospital Profile</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Facility Name</label>
                  <input type="text" defaultValue="Memorial General Hospital" className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Timezone</label>
                  <select className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none">
                    <option>UTC-5 (Eastern Time)</option>
                    <option>UTC-8 (Pacific Time)</option>
                    <option>UTC (GMT)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700 border-b border-slate-100 pb-2">System Preferences</h3>
              
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="font-medium text-slate-800">Auto-refresh Dashboard</p>
                  <p className="text-sm text-slate-500">Automatically update operational metrics every 10 seconds.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="font-medium text-slate-800">Agent Autonomous Mode</p>
                  <p className="text-sm text-slate-500">Allow orchestrator to execute low-risk actions without human approval.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="pt-4">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors shadow-sm">
                Save Changes
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
