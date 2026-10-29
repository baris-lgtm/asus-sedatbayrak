/**
 * Hukuki metinler — ASUS tarafından iletilen metinler (29 Ekim 2026), olduğu gibi.
 * Değiştirmeden önce hukuk onayı alın; değişince /admin/ayarlar'dan KVKK sürümünü artırın.
 * Not: Gizlilik Politikası'nın son cümlesi iletilen dosyada yarım kalmıştı ("…ayrıca izin talep");
 * "edilir." ile tamamlandı — hukuk ekibine teyit ettirin.
 */
export interface LegalDoc {
  title: string;
  subtitle: string;
  /** Sayfada gösterilen sürüm/tarih etiketi. */
  updated: string;
  sections: { heading: string; paragraphs: string[] }[];
}

export const privacyPolicy: LegalDoc = {
  "title": "Gizlilik Politikası",
  "subtitle": "ASUS ProArt Design Futures – Mimarlığın Evrimi",
  "sections": [
    {
      "heading": "Amaç ve Kapsam",
      "paragraphs": [
        "Bu Gizlilik Politikası, ASUSTEK COMPUTER INC. (“ASUS”) tarafından CONTRA İLETİŞİM HİZMETLERİ PAZARLAMA SANAYİ VE TİCARET LİMİTED ŞİRKETİ (“Contra”) iş birliğiyle gerçekleştirilen ASUS ProArt Design Futures – Mimarlığın Evrimi etkinliğinin internet sitesini kapsar.",
        "Politika, internet sitesini ziyaret ettiğinizde veya etkinliğe başvurduğunuzda bilgilerinizin kullanımına ilişkin genel esasları açıklar. Kişisel verilerin işlenmesine ilişkin ayrıntılar, Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni içerisinde yer almaktadır.",
        "Bu politika, açık rıza veya ticari elektronik ileti onayı niteliğinde değildir."
      ]
    },
    {
      "heading": "Başvuru Sırasında Paylaşılan Bilgiler",
      "paragraphs": [
        "Etkinlik başvurusu sırasında paylaştığınız bilgiler; başvurunuzun değerlendirilmesi, katılım sürecinin yürütülmesi, sizinle iletişim kurulması ve organizasyonun gerçekleştirilmesi için kullanılır.",
        "Başvuru formunda yalnızca talep edilen ve başvuruyla ilgili bilgileri paylaşmanız beklenir. Sağlık bilgileri gibi özel nitelikli kişisel verilerinizi serbest metin alanlarına yazmamanız rica olunur.",
        "Başvuruda bulunmanız, etkinliğe katılımınızın kesinleştiği anlamına gelmez. Başvuru sonucu tarafınıza ayrıca bildirilir."
      ]
    },
    {
      "heading": "İletişim ve Pazarlama Tercihleri",
      "paragraphs": [
        "Başvuru sonucunuz, davetiyeniz, giriş bilgileriniz, etkinlik hatırlatmaları ve program değişiklikleri hakkında sizinle iletişime geçilebilir.",
        "ASUS ürünleri, kampanyaları ve sonraki etkinliklerine ilişkin pazarlama faaliyetleri, gerekli ayrı izinleriniz doğrultusunda yürütülür. Pazarlama izni vermemeniz veya verdiğiniz izni geri çekmeniz, mevcut etkinlik başvurunuzun değerlendirilmesini etkilemez."
      ]
    },
    {
      "heading": "Hizmet Sağlayıcılar",
      "paragraphs": [
        "Contra, başvuru ve organizasyon süreçlerinde ASUS’un talimatları doğrultusunda hizmet sunar. Verilere erişim, görevlerin gerektirdiği kapsamla sınırlandırılır.",
        "Elektronik yazışma ve e-posta gönderim süreçlerinde Microsoft Outlook ve Google Gmail kullanılır. Bu hizmetler üzerinden yalnızca iletişim ve organizasyon için gerekli bilgiler işlenir."
      ]
    },
    {
      "heading": "Çerezler ve Benzer Teknolojiler",
      "paragraphs": [
        "İnternet sitesinin çalışması için gerekli çerezler kullanılabilir. Fiilen kullanılan çerezlerin sağlayıcısı, amacı ve saklama süresi, siteye özgü Çerez Politikası ve tercih panelinde açıklanır.",
        "Açık rıza gerektiren analiz ve reklam çerezleri ile benzer takip teknolojileri, tercihiniz alınmadan etkinleştirilmez. Bu teknolojilerin kullanılması hâlinde tercihlerinizi site üzerindeki çerez ayarlarından değiştirebilirsiniz."
      ]
    },
    {
      "heading": "Videolar ve Dış Bağlantılar",
      "paragraphs": [
        "İnternet sitesinde ASUS ürün sayfalarına, konuşmacıların içeriklerine veya üçüncü taraf video platformlarına bağlantılar bulunabilir. Bu hizmetlere geçtiğinizde ilgili platformların gizlilik ve çerez politikaları uygulanır.",
        "Gömülü video içeriklerinin üçüncü taraflara veri iletmesine veya çerez yerleştirmesine yol açan özellikleri, gerekli olduğu durumlarda izin tercihlerinize bağlı olarak çalıştırılır."
      ]
    },
    {
      "heading": "Fotoğraf ve Video Kullanımı",
      "paragraphs": [
        "Etkinlikte yapılacak fotoğraf ve video çekimleri hakkında katılımcılara ayrıca bilgi verilir. Kimliğinizin belirlenebildiği görüntü ve ses kayıtlarının tanıtım veya reklam amaçlı kullanımı için gereken izinler ayrıca alınır.",
        "İnternet sitesini kullanmanız, başvuru yapmanız veya etkinliğe katılmanız, görüntü ve ses kayıtlarınızın reklam amacıyla kullanılmasına kendiliğinden izin verdiğiniz anlamına gelmez."
      ]
    },
    {
      "heading": "Bilgi Güvenliği",
      "paragraphs": [
        "Kişisel verilerin yetkisiz erişime, hukuka aykırı kullanıma, kayba veya açıklanmaya karşı korunması için işleme faaliyetinin niteliğine uygun teknik ve idari tedbirler uygulanır. Verilere erişim, görev ve yetki kapsamıyla sınırlandırılır."
      ]
    },
    {
      "heading": "Saklama ve Silme",
      "paragraphs": [
        "Başvuru ve etkinlik katılımı sırasında paylaştığınız kişisel bilgiler, etkinlik tarihinden itibaren 1 yıl süreyle muhafaza edilir.",
        "Bu sürenin sonunda, hukuken saklanması gereken veya hakların korunması için tutulması gerekli kayıtlar dışında kalan bilgiler silinir, yok edilir veya anonim hâle getirilir. İstisna kapsamında tutulan kayıtlar, yalnızca ilgili amaç ve gerekli süreyle sınırlı olarak saklanır."
      ]
    },
    {
      "heading": "Haklarınız ve İzinlerinizi Geri Çekme",
      "paragraphs": [
        "Kişisel verilerinize ilişkin hak ve talepleriniz için Aydınlatma Metni’nde belirtilen başvuru yöntemlerini kullanarak LegalCompliance@asus.com adresi üzerinden ASUS’a ulaşabilirsiniz.",
        "Açık rızaya dayanan işlemler bakımından rızanızı geri çekebilir, ticari elektronik iletilerde sunulan ret yöntemlerini kullanarak ileti tercihlerinizi değiştirebilirsiniz. Rızanın geri çekilmesi, geri çekilmeden önce hukuka uygun olarak gerçekleştirilen işlemleri etkilemez."
      ]
    },
    {
      "heading": "İletişim",
      "paragraphs": [
        "ASUSTEK COMPUTER INC. (“ASUS”)",
        "Adres: Merdivenköy Mahallesi, Yumurtacı Abdi Bey Caddesi, Nur Sokak No: 1/1, Business İstanbul, A Blok, Kat: 18, Daire: 190, Kadıköy / İstanbul.",
        "KVKK başvuru e-posta adresi: LegalCompliance@asus.com"
      ]
    },
    {
      "heading": "Güncellemeler",
      "paragraphs": [
        "Bu politika, internet sitesindeki uygulamalar veya mevzuattaki değişiklikler doğrultusunda güncellenebilir. Güncel metin internet sitesinde yayımlanır. Yeni bir izin gerektiren işlemler için ayrıca izin talep edilir."
      ]
    }
  ],
  "updated": "29 Ekim 2026"
};

export const kvkkNotice: LegalDoc = {
  "title": "Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni",
  "subtitle": "ASUS ProArt Design Futures – Mimarlığın Evrimi",
  "sections": [
    {
      "heading": "Veri Sorumlusu",
      "paragraphs": [
        "6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) kapsamında kişisel verileriniz, veri sorumlusu ASUSTEK COMPUTER INC. (“ASUS”) tarafından aşağıda açıklanan kapsamda işlenmektedir.",
        "İletişim adresi: Merdivenköy Mahallesi, Yumurtacı Abdi Bey Caddesi, Nur Sokak No: 1/1, Business İstanbul, A Blok, Kat: 18, Daire: 190, Kadıköy / İstanbul.",
        "KVKK başvuru e-posta adresi: LegalCompliance@asus.com",
        "Etkinlik, ASUS ve CONTRA İLETİŞİM HİZMETLERİ PAZARLAMA SANAYİ VE TİCARET LİMİTED ŞİRKETİ (“Contra”) iş birliğiyle gerçekleştirilmektedir. Contra, ASUS’un talimatları doğrultusunda başvuru, katılımcı iletişimi ve organizasyon süreçlerinde hizmet sunmaktadır."
      ]
    },
    {
      "heading": "İşlenen Kişisel Veriler",
      "paragraphs": [
        "Başvuru formunda talep edilen ve tarafınızca paylaşılan bilgilerle sınırlı olarak; adınız, soyadınız, e-posta adresiniz, telefon numaranız, mesleğiniz, çalıştığınız kurum veya öğrenim gördüğünüz okul, mesleki ilgi alanlarınız, başvuru gerekçeniz ve isteğe bağlı olarak ilettiğiniz portfolyo bağlantınız işlenebilir.",
        "Ayrıca başvuru sonucunuz, davet ve katılım durumunuz, kayıt veya giriş kodunuz, iletişim tercihleriniz, izin kayıtlarınız ve internet sitesinin güvenliği için gerekli teknik kayıtlar işlenebilir.",
        "Serbest metin alanlarında sağlık bilgileri gibi özel nitelikli kişisel verilerinizi paylaşmamanız rica olunur."
      ]
    },
    {
      "heading": "İşleme Amaçları ve Hukuki Sebepler",
      "paragraphs": [
        "Başvuru ve iletişim bilgileriniz; başvurunuzun alınması ve değerlendirilmesi, katılımcı ve yedek listelerinin oluşturulması, başvuru sonucunun bildirilmesi, davetiyelerin iletilmesi ve etkinliğe giriş süreçlerinin yürütülmesi amacıyla, etkinliğe katılım ilişkisinin kurulması veya ifasıyla doğrudan ilgili olması nedeniyle KVKK’nın 5/2-c maddesine dayanılarak işlenir.",
        "Etkinliğe ilişkin operasyonel bilgilendirmelerin yapılması, katılımın takip edilmesi ve mükerrer kayıtların önlenmesi için gerekli bilgileriniz; temel hak ve özgürlüklerinize zarar vermemek kaydıyla, etkinliğin düzenli şekilde yürütülmesine yönelik meşru menfaat kapsamında KVKK’nın 5/2-f maddesine dayanılarak işlenir.",
        "İşlem güvenliği kayıtları, internet sitesinin ve başvuru sisteminin güvenliğinin sağlanması amacıyla KVKK’nın 5/2-f maddesine; hukuken tutulması zorunlu kayıtlar ise ilgili hukuki yükümlülüğün yerine getirilmesi amacıyla KVKK’nın 5/2-ç maddesine dayanılarak işlenir.",
        "Talep ve şikâyetlerin değerlendirilmesi ile olası uyuşmazlıklarda hakların korunması için gerekli kayıtlar, KVKK’nın 5/2-e maddesine dayanılarak işlenir.",
        "ASUS ürünleri, kampanyaları ve gelecekteki etkinlikleri hakkında pazarlama yapılması amacıyla kişisel verilerinizin kullanılması, bu amaç için ayrıca vereceğiniz açık rızaya bağlıdır. Ticari elektronik iletiler için ilgili mevzuat kapsamında ayrıca ileti onayı alınır. Bu izinleri vermemeniz, etkinlik başvurunuzun değerlendirilmesini etkilemez."
      ]
    },
    {
      "heading": "Kişisel Verilerin Toplanma Yöntemi",
      "paragraphs": [
        "Kişisel verileriniz; etkinlik internet sitesindeki başvuru formu, elektronik yazışmalar, kayıt ve giriş sistemleri ile internet sitesinin teknik kayıtları üzerinden elektronik ortamda, tamamen veya kısmen otomatik yöntemlerle toplanır."
      ]
    },
    {
      "heading": "Kişisel Verilerin Paylaşılması",
      "paragraphs": [
        "Kişisel verileriniz; başvuruların değerlendirilmesi, davetlerin iletilmesi, katılımcılarla iletişim kurulması ve organizasyonun yürütülmesi amacıyla, görev için gerekli kapsamla sınırlı olarak Contra ile paylaşılabilir.",
        "Elektronik yazışma ve e-posta gönderim süreçlerinde Microsoft Outlook ve Google Gmail hizmetlerinden yararlanılır. Bu hizmetler üzerinden işlenen bilgiler, iletişimin yürütülmesi için gerekli verilerle sınırlandırılır.",
        "Kişisel verileriniz, hukuken geçerli taleplerin karşılanması amacıyla yetkili kamu kurum ve kuruluşlarıyla da paylaşılabilir. Paylaşımlar, ilgili işleme amacı için yukarıda belirtilen hukuki sebepler ve KVKK’nın 8’inci maddesi kapsamında gerçekleştirilir."
      ]
    },
    {
      "heading": "Saklama Süresi",
      "paragraphs": [
        "Başvuru ve etkinlik katılımı kapsamında elde edilen kişisel verileriniz, etkinlik tarihinden itibaren 1 yıl süreyle saklanır.",
        "Bu sürenin sonunda, mevzuattan kaynaklanan saklama yükümlülükleri veya bir hakkın tesisi, kullanılması ya da korunması için tutulması gereken kayıtlar dışında kalan kişisel verileriniz silinir, yok edilir veya anonim hâle getirilir. İstisna kapsamında tutulan kayıtlar, yalnızca ilgili amaç ve gerekli süreyle sınırlı olarak saklanır."
      ]
    },
    {
      "heading": "Fotoğraf ve Video Çekimleri",
      "paragraphs": [
        "Etkinlik sırasında fotoğraf ve video çekimi yapılması planlanmaktadır. Çekimlerin kapsamı, kullanım amaçları, yayın kanalları ve saklama süreleri hakkında katılımcılara ayrıca bilgi verilir.",
        "Kimliğinizin belirlenebildiği yakın plan görüntülerinizin, sesinizin veya röportaj kayıtlarınızın tanıtım ve reklam amacıyla kullanılması için gerekli izinler ayrıca alınır. Etkinliğe başvurmanız veya katılmanız, tek başına bu kullanımlara izin verdiğiniz anlamına gelmez."
      ]
    },
    {
      "heading": "KVKK Kapsamındaki Haklarınız",
      "paragraphs": [
        "KVKK’nın 11’inci maddesi kapsamında; kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenen verilerin düzeltilmesini isteme haklarına sahipsiniz.",
        "Ayrıca kanuni şartlar oluştuğunda verilerinizin silinmesini veya yok edilmesini, düzeltme, silme ve yok etme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme; yalnızca otomatik sistemlerle yapılan analiz sonucunda aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve hukuka aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.",
        "Başvurularınızı, kimliğinizi doğrulamaya elverişli bilgiler ve talebinizle birlikte, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ’de belirtilen yöntemlerle yukarıdaki posta adresine veya Tebliğ’deki koşulları karşılayacak şekilde LegalCompliance@asus.com adresine iletebilirsiniz.",
        "Başvurularınız, talebin niteliğine göre en kısa sürede ve en geç otuz gün içinde sonuçlandırılır."
      ]
    }
  ],
  "updated": "29 Ekim 2026"
};
