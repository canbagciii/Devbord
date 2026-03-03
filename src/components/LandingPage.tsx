import React, { useState } from 'react';
import { BarChart3, Zap, Users, LinkIcon, Building2, TrendingUp, Bell } from 'lucide-react';
import { RegistrationModal } from './RegistrationModal';
import { LoginModal } from './LoginModal';

export const LandingPage: React.FC = () => {
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 px-[5%] flex items-center justify-between h-17">
        <a href="#" className="flex items-center gap-3 font-bold text-xl text-gray-900">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center relative overflow-hidden">
            <div className="absolute w-2.5 h-4.5 rounded-sm bg-white left-2 bottom-2" />
            <div className="absolute w-2.5 h-3 rounded-sm bg-white/50 right-2 bottom-2" />
          </div>
          DevPulse
        </a>
        <ul className="hidden md:flex items-center gap-8 list-none">
          <li><a href="#problem" className="text-gray-600 text-sm font-medium hover:text-blue-600 transition-colors">Sorunlar</a></li>
          <li><a href="#how" className="text-gray-600 text-sm font-medium hover:text-blue-600 transition-colors">Nasıl Çalışır</a></li>
          <li><a href="#features" className="text-gray-600 text-sm font-medium hover:text-blue-600 transition-colors">Özellikler</a></li>
        </ul>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-gray-900 bg-transparent border-[1.5px] border-gray-300 hover:border-blue-600 hover:text-blue-600 transition-all"
          >
            Giriş Yap
          </button>
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/30 hover:-translate-y-0.5 transition-all"
          >
            Ücretsiz Başla →
          </button>
        </div>
      </nav>

      <section className="pt-[140px] pb-[100px] px-[5%]">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
          <div className="animate-in fade-in slide-in-from-left duration-700">
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-6 border border-blue-600/15">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              Jira + Kolay İK entegrasyonu
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-gray-900 mb-5">
              Ekibinizin <span className="text-blue-600">nabzını</span> gerçek zamanlı takip edin
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-9 max-w-md">
              Sprint yönetimi, yazılımcı performans takibi ve İK entegrasyonunu tek platformda birleştirin. Karar vermek için saatlerce rapor hazırlamayı bırakın.
            </p>
            <div className="flex gap-3 flex-wrap mb-4">
              <button
                onClick={() => setIsRegisterModalOpen(true)}
                className="px-7 py-3.5 rounded-xl text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/35 hover:-translate-y-1 transition-all"
              >
                Hemen Başla — Ücretsiz
              </button>
              <button className="px-6 py-3.5 rounded-xl text-base font-semibold text-gray-900 bg-transparent border-[1.5px] border-gray-300 hover:border-blue-600 hover:text-blue-600 transition-all">
                Nasıl çalışır?
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600 mt-4">
              <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              Kurulum yok · Kredi kartı yok · Dakikalar içinde hazır
            </div>
            <div className="mt-12">
              <div className="text-[0.7rem] font-semibold text-gray-400 uppercase tracking-widest mb-3.5">Desteklenen entegrasyonlar</div>
              <div className="flex gap-2.5 flex-wrap">
                <div className="flex items-center gap-2 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3.5 py-2 text-[0.82rem] font-semibold text-gray-900">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#2563EB"><path d="M11.571 11.513H0a5.218 5.218 0 005.232 5.215h2.13v2.057A5.215 5.215 0 0012.575 24V12.518a1.005 1.005 0 00-1.004-1.005zm5.723-5.756H5.757a5.215 5.215 0 005.215 5.214h2.129v2.058a5.218 5.218 0 005.215 5.214V6.762a1.005 1.005 0 00-1.022-1.005zM23.012 0H11.455a5.215 5.215 0 005.215 5.214h2.129v2.058A5.218 5.218 0 0024 12.487V1.005A1.005 1.005 0 0023.012 0z"/></svg>
                  Jira
                </div>
                <div className="flex items-center gap-2 bg-gray-50 border-[1.5px] border-gray-200 rounded-lg px-3.5 py-2 text-[0.82rem] font-semibold text-gray-900">
                  <div className="w-4 h-4 rounded bg-green-600 flex items-center justify-center text-white text-[0.65rem] font-bold">İK</div>
                  Kolay İK
                </div>
              </div>
            </div>
          </div>

          <div className="relative animate-in fade-in slide-in-from-bottom duration-800">
            <div className="absolute top-[-20px] left-[-30px] bg-white border-[1.5px] border-gray-200 rounded-xl p-3 pr-4 shadow-lg flex items-center gap-2.5 z-10">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-base">🚀</div>
              <div>
                <div className="text-base font-extrabold">Sprint 14</div>
                <div className="text-[0.7rem] text-gray-500">Aktif sprint</div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border-[1.5px] border-gray-200 shadow-2xl p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <div className="font-bold text-[0.95rem]">Sprint Özeti</div>
                <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md text-xs font-semibold">Aktif</span>
              </div>
              <div className="mb-5">
                <div className="flex justify-between text-[0.8rem] text-gray-600 mb-2">
                  <span>Tamamlanma</span>
                  <span className="font-semibold text-blue-600">72%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-1000" style={{ width: '72%' }} />
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[0.7rem] font-bold flex-shrink-0">AK</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.82rem] font-semibold text-gray-900">Ahmet Kaya</div>
                    <div className="text-[0.74rem] text-gray-600 truncate">AUTH-124: Login flow refactor</div>
                  </div>
                  <span className="bg-green-50 text-green-600 text-[0.72rem] font-semibold px-2 py-0.5 rounded flex-shrink-0">Bitti</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-[0.7rem] font-bold flex-shrink-0">SE</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.82rem] font-semibold text-gray-900">Selin Erdoğan</div>
                    <div className="text-[0.74rem] text-gray-600 truncate">API-88: Rate limiting middleware</div>
                  </div>
                  <span className="bg-amber-50 text-amber-600 text-[0.72rem] font-semibold px-2 py-0.5 rounded flex-shrink-0">Devam</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-[0.7rem] font-bold flex-shrink-0">MÇ</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.82rem] font-semibold text-gray-900">Mert Çelik</div>
                    <div className="text-[0.74rem] text-gray-600 truncate">UI-201: Dashboard redesign</div>
                  </div>
                  <span className="bg-purple-50 text-purple-600 text-[0.72rem] font-semibold px-2 py-0.5 rounded flex-shrink-0">Review</span>
                </div>
              </div>
            </div>
            <div className="absolute bottom-[-20px] right-[-20px] bg-white border-[1.5px] border-gray-200 rounded-xl p-3 pr-4 shadow-lg flex items-center gap-2.5 z-10">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-base">✅</div>
              <div>
                <div className="text-base font-extrabold">18/25</div>
                <div className="text-[0.7rem] text-gray-500">Görev tamamlandı</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="problem" className="py-[100px] px-[5%] bg-gray-50 border-t border-b border-gray-200">
        <div className="max-w-[1100px] mx-auto text-center">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md mb-4">Tanıdık geldi mi?</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 max-w-[600px] mx-auto">Her takımın yaşadığı 3 büyük sorun</h2>
          <p className="text-lg text-gray-600 max-w-[540px] mx-auto leading-relaxed">DevPulse, yazılım ekiplerinin sprint ve insan kaynakları süreçlerinde yaşadığı karmaşayı ortadan kaldırır.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1100px] mx-auto mt-14">
          <div className="bg-white border-[1.5px] border-gray-200 rounded-2xl p-7 hover:border-blue-600 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-3.5">🌀</div>
            <h3 className="text-base font-bold mb-2 text-gray-900">Dağınık Sprint Takibi</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Jira açık, Excel açık, Slack açık… Hangi bilgiye inanacağınızı bilemiyorsunuz. Toplantıdan önce manuel rapor hazırlamak saatlerinizi alıyor.</p>
          </div>
          <div className="bg-white border-[1.5px] border-gray-200 rounded-2xl p-7 hover:border-blue-600 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-3.5">🔗</div>
            <h3 className="text-base font-bold mb-2 text-gray-900">İK ile Kopuk İletişim</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Yazılımcıların izin, mesai ve proje bilgilerini İK ile senkronize etmek için cepten cepte mesaj gidiyor. Hata payı yüksek, güncellik düşük.</p>
          </div>
          <div className="bg-white border-[1.5px] border-gray-200 rounded-2xl p-7 hover:border-blue-600 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="text-3xl mb-3.5">📊</div>
            <h3 className="text-base font-bold mb-2 text-gray-900">Kör Performans Raporları</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Hangi developer ne kadar katkı sağladı? Bottleneck nerede? Cevaplar mevcut araçlarda gömülü, bulmak için araştırmacı olmak gerekiyor.</p>
          </div>
        </div>
      </section>

      <section id="features" className="py-[100px] px-[5%] bg-gray-50 border-t border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md mb-4">Özellikler</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 max-w-[600px] mx-auto">Ekibinizi yönetmek için ihtiyacınız olan her şey</h2>
            <p className="text-lg text-gray-600 max-w-[540px] mx-auto leading-relaxed">Sprint yönetiminden İK entegrasyonuna, gerçek zamanlı veriden akıllı raporlamaya kadar.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Zap className="w-6 h-6 text-blue-600" />, title: 'Gerçek Zamanlı Sprint Takibi', desc: 'Jira\'dan otomatik çekilen verilerle sprint ilerlemenizi canlı olarak izleyin. Görev durumları, tamamlanma yüzdeleri ve kalan süreler tek bakışta.' },
              { icon: <Users className="w-6 h-6 text-blue-600" />, title: 'Developer Performans Analizi', desc: 'Her yazılımcının sprint bazında katkısını, tamamladığı görevleri ve çalışma hızını ölçün. Adil ve veriye dayalı değerlendirme yapın.' },
              { icon: <LinkIcon className="w-6 h-6 text-blue-600" />, title: 'Jira Entegrasyonu', desc: 'Mevcut Jira projelerinizle tam entegrasyon. Ticket\'lar, board\'lar, sprint\'ler — hepsi DevPulse\'ta, hiçbir veri girilmesine gerek yok.' },
              { icon: <Building2 className="w-6 h-6 text-blue-600" />, title: 'Kolay İK Entegrasyonu', desc: 'İzin ve mesai bilgilerini sprint planlamasına yansıtın. Kimin ne zaman uygun olduğunu tek platformdan görün, sürpriz kapasitesi sorunlarına son.' },
              { icon: <TrendingUp className="w-6 h-6 text-blue-600" />, title: 'Akıllı Raporlama', desc: 'Otomatik oluşturulan sprint raporları ve trend analizleriyle paydaşlarınıza dakikalar içinde sunum yapın. Velocity, burndown ve daha fazlası.' },
              { icon: <Bell className="w-6 h-6 text-blue-600" />, title: 'Proaktif Uyarılar', desc: 'Sprint kapanmadan önce riskli görevleri fark edin. Gecikme ihtimali yüksek ticket\'lar ve bottleneck noktaları için otomatik bildirim alın.' },
            ].map((feature, i) => (
              <div key={i} className="bg-white border-[1.5px] border-gray-200 rounded-2xl p-8 hover:border-blue-600 hover:shadow-2xl hover:-translate-y-1 transition-all relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
                    {feature.icon}
                  </div>
                  <h3 className="text-base font-bold mb-2.5 text-gray-900">{feature.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-[60px] px-[5%]">
        <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-3xl mx-[5%] p-[72px]">
          <div className="max-w-[1100px] mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-white text-3xl md:text-4xl font-extrabold mb-3">Sayılar konuşuyor</h2>
              <p className="text-white/60 text-base">DevPulse kullanan ekipler ne kazanıyor?</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
              {[
                { num: '%40', label: 'Daha az rapor hazırlama süresi' },
                { num: '3×', label: 'Daha hızlı sprint kapanışı' },
                { num: '%95', label: 'Veri doğruluk oranı' },
                { num: '<5dk', label: 'Kurulum ve entegrasyon süresi' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-white text-5xl font-extrabold mb-1.5">{stat.num}</div>
                  <div className="text-white/60 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-[100px] px-[5%] bg-gray-50 border-t border-gray-200">
        <div className="max-w-[640px] mx-auto text-center">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md mb-4">Başlamaya hazır mısınız?</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4">Ekibinizin potansiyelini bugün keşfedin</h2>
          <p className="text-gray-600 mb-9 text-lg">Jira hesabınızla dakikalar içinde entegrasyon tamamlanır. Kolay İK bağlantısını istediğiniz zaman ekleyebilirsiniz.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="px-7 py-3.5 rounded-xl text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/35 hover:-translate-y-1 transition-all"
            >
              Ücretsiz Hesap Oluştur →
            </button>
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="px-6 py-3.5 rounded-xl text-base font-semibold text-gray-900 bg-transparent border-[1.5px] border-gray-300 hover:border-blue-600 hover:text-blue-600 transition-all"
            >
              Zaten hesabım var
            </button>
          </div>
        </div>
      </section>

      <footer className="py-10 px-[5%] border-t border-gray-200 flex items-center justify-between flex-wrap gap-4">
        <div className="font-bold text-base text-gray-900">DevPulse</div>
        <ul className="flex gap-6 list-none">
          <li><a href="#" className="text-sm text-gray-600 hover:text-blue-600 no-underline">Gizlilik</a></li>
          <li><a href="#" className="text-sm text-gray-600 hover:text-blue-600 no-underline">Kullanım Koşulları</a></li>
          <li><a href="#" className="text-sm text-gray-600 hover:text-blue-600 no-underline">Destek</a></li>
        </ul>
        <p className="text-[0.82rem] text-gray-400">© 2025 DevPulse. Tüm hakları saklıdır.</p>
      </footer>

      {isRegisterModalOpen && <RegistrationModal onClose={() => setIsRegisterModalOpen(false)} />}
      {isLoginModalOpen && <LoginModal onClose={() => setIsLoginModalOpen(false)} />}
    </div>
  );
};
