import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useServerStore } from '@/stores/useServerStore';
import { useAuthStore } from '@/stores/useAuthStore';

export default function DashboardPage() {
    const { servers, fetchServers, deleteServer } = useServerStore();
    const { logout } = useAuthStore();
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        fetchServers();
    }, [fetchServers]);

    return (
        <div className="h-screen bg-gray-900 text-white p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <div>
                    <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-4">
                        + Add Server
                    </button>
                    <button onClick={logout} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
                        Logout
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {servers.map(server => (
                    <div key={server.id} className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h2 className="text-xl font-bold mb-2">{server.name}</h2>
                        <p className="text-gray-400 mb-4">{server.username}@{server.host}:{server.port}</p>
                        <div className="flex justify-end space-x-2">
                            <Link to={`/server/${server.id}/session`} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm">
                                Connect
                            </Link>
                            {/* <button className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded text-sm">Edit</button> */}
                            <button onClick={() => deleteServer(server.id)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm">
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            {showAddModal && <AddServerModal onClose={() => setShowAddModal(false)} />}
        </div>
    );
}

function AddServerModal({ onClose }) {
    const [name, setName] = useState('');
    const [host, setHost] = useState('');
    const [port, setPort] = useState(22);
    const [username, setUsername] = useState('');
    const [auth_method, setAuthMethod] = useState('password');
    const [credentials, setCredentials] = useState('');
    const { addServer } = useServerStore();

    const handleSubmit = (e) => {
        e.preventDefault();
        addServer({ name, host, port, username, auth_method, credentials });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-gray-800 p-8 rounded-lg w-1/3">
                <h2 className="text-2xl font-bold mb-6">Add a New Server</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block mb-1">Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 rounded bg-gray-700" />
                    </div>
                    <div className="mb-4">
                        <label className="block mb-1">Host</label>
                        <input type="text" value={host} onChange={e => setHost(e.target.value)} className="w-full p-2 rounded bg-gray-700" />
                    </div>
                    <div className="mb-4">
                        <label className="block mb-1">Port</label>
                        <input type="number" value={port} onChange={e => setPort(parseInt(e.target.value))} className="w-full p-2 rounded bg-gray-700" />
                    </div>
                    <div className="mb-4">
                        <label className="block mb-1">Username</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-2 rounded bg-gray-700" />
                    </div>
                    <div className="mb-4">
                        <label className="block mb-1">Auth Method</label>
                        <select value={auth_method} onChange={e => setAuthMethod(e.target.value)} className="w-full p-2 rounded bg-gray-700">
                            <option value="password">Password</option>
                            <option value="key">SSH Key</option>
                        </select>
                    </div>
                    <div className="mb-4">
                        <label className="block mb-1">{auth_method === 'password' ? 'Password' : 'Private Key'}</label>
                        {auth_method === 'password' ? (
                            <input type="password" value={credentials} onChange={e => setCredentials(e.target.value)} className="w-full p-2 rounded bg-gray-700" />
                        ) : (
                            <textarea value={credentials} onChange={e => setCredentials(e.target.value)} className="w-full p-2 rounded bg-gray-700" rows={5}></textarea>
                        )}
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Add Server</button>
                        <button type="button" onClick={onClose} className="ml-4 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
