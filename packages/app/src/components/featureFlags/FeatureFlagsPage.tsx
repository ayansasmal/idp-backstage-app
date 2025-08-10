import { useState, useEffect } from 'react';

export const FeatureFlagsPage = () => {
    const [flags, setFlags] = useState<Array<{ name: string }>>([]);
    const [filter, setFilter] = useState('');
    const [form, setForm] = useState({ tenant: '', environment: '', application: '', flagName: '' });

    useEffect(() => {
        fetch('/api/feature-flags')
            .then(res => res.json())
            .then(setFlags);
    }, []);

    const filteredFlags = flags.filter(flag => flag.name.includes(filter));

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };


    const handleCreateFlag = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await fetch('/api/feature-flags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            setForm({ tenant: '', environment: '', application: '', flagName: '' });
            // Refresh flag list
            fetch('/api/feature-flags')
                .then(r => r.json())
                .then(setFlags);
        } else {
            const error = await res.json();
            // Optionally display error in UI
            console.error('Error creating flag:', error.error);
        }
    };

    return (
        <div>
            <h1>Feature Flags</h1>
            <form onSubmit={handleCreateFlag} style={{ marginBottom: 16 }}>
                <input name="tenant" placeholder="Tenant" value={form.tenant} onChange={handleInputChange} required />
                <input name="environment" placeholder="Environment" value={form.environment} onChange={handleInputChange} required />
                <input name="application" placeholder="Application" value={form.application} onChange={handleInputChange} required />
                <input name="flagName" placeholder="Flag Name" value={form.flagName} onChange={handleInputChange} required />
                <button type="submit">Create Flag</button>
            </form>
            <input
                type="text"
                placeholder="Filter flags..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                style={{ marginBottom: 16 }}
            />
            <table>
                <thead>
                    <tr>
                        <th>Tenant</th>
                        <th>Environment</th>
                        <th>Application</th>
                        <th>Flag Name</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredFlags.map((flag: { name: string }) => {
                        const [tenant, environment, application, ...flagParts] = flag.name.split('.');
                        return (
                            <tr key={flag.name}>
                                <td>{tenant}</td>
                                <td>{environment}</td>
                                <td>{application}</td>
                                <td>{flagParts.join('.') || ''}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

