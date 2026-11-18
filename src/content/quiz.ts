import "server-only";

/**
 * Etkinlik günü quizi. Doğru cevaplar YALNIZCA sunucuda tutulur; istemciye
 * `publicQuestions()` ile cevapsız sürüm gönderilir. Soru eklemek/çıkarmak
 * için bu listeyi düzenle (id'ler benzersiz kalmalı). Kaynak: quiz soruları belgesi (18 Kasım).
 */
export interface QuizQuestion {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  /** 0 = A, 1 = B, 2 = C, 3 = D */
  answer: 0 | 1 | 2 | 3;
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: "q01",
    prompt: "SketchUp yazılımını ilk geliştiren şirket hangisidir?",
    options: ["Autodesk", "Trimble", "@Last Software", "Google"],
    answer: 2,
  },
  {
    id: "q02",
    prompt: "AutoCAD'de Properties panelini açan varsayılan kısayol hangisidir?",
    options: ["Ctrl+P", "Ctrl+Shift+P", "Ctrl+1", "Ctrl+0"],
    answer: 2,
  },
  {
    id: "q03",
    prompt: "Grasshopper, hangi 3B modelleme yazılımıyla bütünleşik çalışan bir görsel programlama ortamıdır?",
    options: ["Rhino", "Hipo", "3ds Max", "Blender"],
    answer: 0,
  },
  {
    id: "q04",
    prompt: "1920 × 1080 çözünürlüğün karşılığı hangisidir?",
    options: ["HD", "Full HD", "2K", "4K"],
    answer: 1,
  },
  {
    id: "q05",
    prompt: "Aşağıdaki yazılımlardan hangisinde GPU performansı, genelde CPU performansından daha belirleyicidir?",
    options: ["3ds Max", "AutoCAD", "Revit", "Lumion"],
    answer: 3,
  },
  {
    id: "q06",
    prompt: "Bir renderın arka planını şeffaf olarak kaydetmek istiyorsun. Şeffaflık bilgisi görüntünün hangi kanalında tutulur?",
    options: ["Roughness", "Bump", "Alpha", "Displacement"],
    answer: 2,
  },
  {
    id: "q07",
    prompt: "Bir peyzaj modeline aynı ağaçtan 2.000 tane yerleştireceksin. Her ağacın geometrisini bağımsız olarak çoğaltmak yerine ortak geometriyi referanslayarak dosyayı hafifletmeye yarayan yöntem hangisidir?",
    options: ["Denoising", "Retopology", "Radiology", "Instancing"],
    answer: 3,
  },
  {
    id: "q08",
    prompt: "GPU ile render alırken yüksek çözünürlüklü dokular ve büyük 3B sahneler için özellikle hangi donanım kapasitesi önem kazanır?",
    options: ["Ekran kartının VRAM kapasitesi", "Bilgisayar kasasının rengi", "İşlemcinin L3 önbelleği", "Monitörün çözünürlüğü"],
    answer: 0,
  },
  {
    id: "q09",
    prompt: "Neme dayanımlı alçı levhalar piyasada yaygın olarak hangi renkle ayırt edilir?",
    options: ["Beyaz", "Yeşil", "Turuncu", "Kırmızı"],
    answer: 1,
  },
  {
    id: "q10",
    prompt: "Aşağıdakilerden hangisi bir marka değil, bir ürün grubunun jenerik ismidir?",
    options: ["Geberit", "Alçıpan", "Terrazzo", "Pimapen"],
    answer: 2,
  },
  {
    id: "q11",
    prompt: "Kırılması halinde cam parçalarının ara katmana tutunmasını sağlayan cam türü hangisidir?",
    options: ["Reflekte cam", "Lamine cam", "Standart float cam", "Tek parça temperli cam"],
    answer: 1,
  },
  {
    id: "q12",
    prompt: "Low-E camdaki 'E' harfi neyi ifade eder?",
    options: ["Energy", "Emissivity", "Exposure", "Efficiency"],
    answer: 1,
  },
  {
    id: "q13",
    prompt: "Aşağıdaki ısı yalıtım malzemelerinden hangisi mineral esaslıdır?",
    options: ["EPS", "XPS", "Taş yünü", "PIR"],
    answer: 2,
  },
  {
    id: "q14",
    prompt: "C30/37 beton sınıfındaki 30 ve 37 değerleri sırasıyla neyi ifade eder?",
    options: ["Kum/çimento oranını", "Tam prizlenmeye ulaştıran gün sayısını 30 ve 37", "1900'lü yılların hangisinde geliştirildiğini (1930-1937)", "Numunelerin karakteristik basınç dayanımlarını"],
    answer: 3,
  },
  {
    id: "q15",
    prompt: "Yapı fiziğinde 'ısı köprüsü' hangi durumu ifade eder?",
    options: ["Isıtma boruları için açılan döşeme boşluğunu", "Isı geçişinin yerel olarak arttığı bölgeyi", "Yapı fiziğiyle ilgili değildir. Mimar Sinan eseridir.", "İki farklı ısıtma sisteminin köprülenmesini"],
    answer: 1,
  },
  {
    id: "q16",
    prompt: "İstanbul Sapphire'in mimari tasarımını hangi ofis gerçekleştirmiştir?",
    options: ["Emre Arolat Architecture", "Tabanlıoğlu Architects", "GAD Architecture", "Yalın Mimarlık"],
    answer: 1,
  },
  {
    id: "q17",
    prompt: "Şişli'deki Hukukçular Sitesi, hangi mimari yaklaşımın Türkiye'deki örneklerinden biridir?",
    options: ["Art Deco", "Postmodernist", "Modernist", "Neoklasik"],
    answer: 2,
  },
  {
    id: "q18",
    prompt: "UIA, Dünya Mimarlık Kongresiyle ilgili hangisi doğrudur?",
    options: ["2005 yılında İstanbul'da yapıldı.", "UIA kongresi hiçbir zaman İstanbul'da yapılmadı.", "UIA mimarlık kongresi değildir.", "İstanbul'da planlanmıştı ama hava muhalefeti sebebiyle iptal edildi."],
    answer: 0,
  },
  {
    id: "q19",
    prompt: "Yeni İstanbul Modern binasının mimarı kimdir?",
    options: ["Renzo Piano", "Tadao Ando", "Emre Arolat", "David Chipperfield"],
    answer: 0,
  },
  {
    id: "q20",
    prompt: "İstanbul Resim ve Heykel Müzesi'nin dönüştürüldüğü Antrepo 5 binasının özgün mimarı kimdir?",
    options: ["Doğan Tekeli", "Emre Arolat", "Hayati Tabanlıoğlu", "Sedad Hakkı Eldem"],
    answer: 3,
  },
  {
    id: "q21",
    prompt: "Taksim'deki eski Atatürk Kültür Merkezi'nin mimarı Hayati Tabanlıoğlu ile yeni AKM'nin mimarı Murat Tabanlıoğlu arasında nasıl bir ilişki vardır?",
    options: ["Amca/yeğen", "Kardeş", "Baba ve oğul", "Akrabalıkları bulunmuyor."],
    answer: 2,
  },
  {
    id: "q22",
    prompt: "Tarihî bir yapının bugün mevcut olan fiziksel durumunu ölçerek belgelemek için hangi çizim çalışması yapılır?",
    options: ["Restitüsyon", "Restorasyon", "Rölöve", "Rekonstrüksiyon"],
    answer: 2,
  },
  {
    id: "q23",
    prompt: "1.000 m² büyüklüğünde bir parselin TAKS değeri 0,20. Yalnızca TAKS hesabına göre yapının taban oturumu en fazla kaç m² olabilir?",
    options: ["100 m²", "200 m²", "500 m²", "800 m²"],
    answer: 1,
  },
  {
    id: "q24",
    prompt: "Hangi yazım doğrudur?",
    options: ["Mütehamit", "Mütahit", "Müteahhit", "Müteahit"],
    answer: 2,
  },
  {
    id: "q25",
    prompt: "Alüminyum cephe üreticisi, profil kesitlerini, birleşim noktalarını ve bağlantı detaylarını fabrikada imalat yapmak üzere çiziyor. Bu çizimler hangi gruptadır?",
    options: ["Shop drawing", "Avan proje", "Vaziyet planı", "Rölöve"],
    answer: 0,
  },
  {
    id: "q26",
    prompt: "Bir projede 450 m² seramik, 70 m³ beton ve 300 metre süpürgelik hesaplanması en olası hangi çalışmanın parçasıdır?",
    options: ["Fizibilite", "Metraj", "Hakediş", "Restitüsyon"],
    answer: 1,
  },
];

export type PublicQuestion = Omit<QuizQuestion, "answer">;

export function publicQuestions(): PublicQuestion[] {
  return quizQuestions.map(({ id, prompt, options }) => ({ id, prompt, options }));
}
