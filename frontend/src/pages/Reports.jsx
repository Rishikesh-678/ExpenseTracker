import { useState, useEffect } from 'react';
import { reportsApi, budgetApi } from '../api';

const CATEGORIES = ['Hardware', 'Software License', 'Cloud Billing', 'Miscellaneous'];

export default function Reports() {
  const [fyList, setFyList] = useState([]);
  const [filters, setFilters] = useState({ status: '', category: '', startDate: '', endDate: '', fiscal_year: '', format: 'csv' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    budgetApi.get().then(r => setFyList(r.data.fyList || []));
  }, []);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await reportsApi.export(filters);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `netops_expenses_${new Date().toISOString().split('T')[0]}.${filters.format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed: ' + (e.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>Reports & Export</h2><p>Download expense data for analysis</p></div>
      </div>

      <div className="form-card" style={{maxWidth:640}}>
        <h3 className="form-title">Export Configuration</h3>
        <div className="form-grid">
          <div className="form-group">
            <label>Fiscal Year</label>
            <select value={filters.fiscal_year} onChange={e=>setFilters(p=>({...p,fiscal_year:e.target.value}))}>
              <option value="">All Fiscal Years</option>
              {fyList.map(fy => <option key={fy}>{fy}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Status Filter</label>
            <select value={filters.status} onChange={e=>setFilters(p=>({...p,status:e.target.value}))}>
              <option value="">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="form-group">
            <label>Category Filter</label>
            <select value={filters.category} onChange={e=>setFilters(p=>({...p,category:e.target.value}))}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Start Date</label>
            <input type="date" value={filters.startDate} onChange={e=>setFilters(p=>({...p,startDate:e.target.value}))}/>
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input type="date" value={filters.endDate} onChange={e=>setFilters(p=>({...p,endDate:e.target.value}))}/>
          </div>
          <div className="form-group full">
            <label>Export Format</label>
            <div style={{display:'flex',gap:12,marginTop:4}}>
              {['csv','xlsx'].map(fmt => (
                <label key={fmt} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:500,color:filters.format===fmt?'var(--accent2)':'var(--text2)'}}>
                  <input type="radio" name="format" value={fmt} checked={filters.format===fmt} onChange={e=>setFilters(p=>({...p,format:e.target.value}))} style={{width:'auto'}}/>
                  {fmt.toUpperCase()}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div style={{marginTop:20,display:'flex',justifyContent:'flex-end'}}>
          <button className="btn btn-primary" onClick={handleExport} disabled={loading}>
            {loading ? 'Exporting…' : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Export {filters.format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>

      <div style={{marginTop:24,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16}}>
        {[
          {label:'Approved Only',desc:'All approved and allocated expenses',s:'approved'},
          {label:'Pending Review',desc:'Expenses awaiting admin decision',s:'pending'},
          {label:'Rejected',desc:'All rejected expense submissions',s:'rejected'},
          {label:'Full Report',desc:'Complete export of all records',s:''},
        ].map(preset => (
          <div key={preset.label} className="stat-card" style={{cursor:'pointer'}} onClick={() => { setFilters(p=>({...p,status:preset.s})); }}>
            <div className="stat-label" style={{marginBottom:6}}>{preset.label}</div>
            <div style={{fontSize:12,color:'var(--text3)'}}>{preset.desc}</div>
            <div style={{marginTop:10,fontSize:11,color:'var(--accent2)',fontWeight:600}}>Click to select →</div>
          </div>
        ))}
      </div>
    </div>
  );
}
