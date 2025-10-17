import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Download, ExternalLink, User, Phone, MessageCircle,
  MapPin, Store, Package, AlertCircle, CheckCircle
} from 'lucide-react';

export default function DistributorFinderDashboard() {
  const [filters, setFilters] = useState({
    platform: 'facebook',
    category: '',
    brand: '',
    location: '',
    hasContact: false,
    showIncomplete: true
  });

  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 🔹 ดึงข้อมูลจาก API จริง
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/data');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const response = await res.json();

        // ✅ รวมโพสต์จากทุกกลุ่ม
        const allPosts = response.data?.groups?.flatMap(g => g.posts) || [];

        // ✅ เพิ่ม id ให้ React ใช้เป็น key
        const formatted = allPosts.map((p, index) => ({
          id: index + 1,
          ...p
        }));

        setResults(formatted);
      } catch (err) {
        console.error('❌ Error fetching data:', err);
        setError('ไม่สามารถดึงข้อมูลจาก API ได้');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    setShowResults(true);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `distributor_leads_${new Date().getTime()}.json`;
    link.click();
  };

  const calculateCompleteness = (post) => {
    let score = 0;
    let total = 5;

    if (post.contact?.hasContact) score++;
    if (post.productInfo?.prices?.length > 0) score++;
    if (post.productInfo?.beerBrands?.length > 0) score++;
    if (post.productInfo?.locations?.length > 0) score++;
    if (post.imageUrl) score++;

    return Math.round((score / total) * 100);
  };

  const filteredResults = results.filter(result => {
    if (filters.category && !result.text?.toLowerCase().includes(filters.category.toLowerCase())) return false;
    if (filters.brand && !result.productInfo?.beerBrands?.some(b => b.toLowerCase().includes(filters.brand.toLowerCase()))) return false;
    if (filters.location && !result.productInfo?.locations?.some(l => l.includes(filters.location))) return false;
    if (filters.hasContact && !result.contact?.hasContact) return false;
    if (!filters.showIncomplete && calculateCompleteness(result) < 80) return false;
    return true;
  });

  const stats = {
    total: filteredResults.length,
    withContact: filteredResults.filter(r => r.contact?.hasContact).length,
    withPrice: filteredResults.filter(r => r.productInfo?.prices?.length > 0).length,
    withLocation: filteredResults.filter(r => r.productInfo?.locations?.length > 0).length,
    avgCompleteness: filteredResults.length > 0
      ? Math.round(filteredResults.reduce((sum, r) => sum + calculateCompleteness(r), 0) / filteredResults.length)
      : 0
  };

  // 🔹 แสดงสถานะโหลดข้อมูล
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-blue-50">
        <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
        <p className="text-blue-800 font-medium">กำลังดึงข้อมูลจาก API...</p>
      </div>
    );
  }

  // 🔹 แสดง error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-50">
        <AlertCircle className="w-10 h-10 text-red-600 mb-4" />
        <p className="text-red-700 font-semibold">{error}</p>
      </div>
    );
  }

  // 🔹 Layout + Results
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
      {/* Header */}
      <div className="bg-white border-b border-blue-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-3 rounded-xl shadow-lg">
              <Store className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Distributor Finder
              </h1>
              <p className="text-sm text-blue-600 font-medium">ค้นหาร้านค้าตัวแทนจำหน่าย</p>
            </div>
          </div>

          <button
            onClick={handleExport}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Search Filter + Results */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl border border-blue-200 p-8 mb-8 shadow-xl">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Filter className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-blue-900">กรองข้อมูล</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-blue-900 mb-2">หมวดหมู่สินค้า</label>
              <input
                type="text"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                placeholder="เช่น เบียร์, สุรา"
                className="w-full bg-blue-50 border-2 border-blue-200 text-blue-900 rounded-xl px-4 py-3"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-blue-900 mb-2">ยี่ห้อ</label>
              <input
                type="text"
                value={filters.brand}
                onChange={(e) => handleFilterChange('brand', e.target.value)}
                placeholder="เช่น ช้าง, สิงห์"
                className="w-full bg-blue-50 border-2 border-blue-200 text-blue-900 rounded-xl px-4 py-3"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-blue-900 mb-2">พื้นที่</label>
              <input
                type="text"
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                placeholder="เช่น กรุงเทพ, เชียงใหม่"
                className="w-full bg-blue-50 border-2 border-blue-200 text-blue-900 rounded-xl px-4 py-3"
              />
            </div>
          </div>

          <button
            onClick={handleSearch}
            className="mt-6 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center space-x-3 transition-all shadow-lg hover:shadow-xl text-lg"
          >
            <Search className="w-6 h-6" />
            <span>ค้นหาตัวแทนจำหน่าย</span>
          </button>
        </div>

        {showResults && (
          <div>
            <h3 className="text-2xl font-bold text-blue-900 mb-6">
              พบทั้งหมด {filteredResults.length} รายการ
            </h3>

            {filteredResults.map((result) => (
              <div key={result.id} className="bg-white rounded-2xl p-6 mb-6 border-2 border-blue-200 shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-lg text-blue-900">{result.author}</h4>
                  <a href={result.postLink} target="_blank" rel="noreferrer" className="text-blue-600 font-medium flex items-center">
                    <ExternalLink className="w-4 h-4 mr-1" /> ดูโพสต์
                  </a>
                </div>
                <p className="text-blue-800 mb-4">{result.text}</p>
                {result.imageUrl && (
                  <img src={result.imageUrl} alt="post" className="rounded-xl w-full max-h-80 object-cover border" />
                )}
                <div className="text-sm text-blue-700 mt-4">
                  👍 {result.engagement.reactions} · 💬 {result.engagement.comments}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}