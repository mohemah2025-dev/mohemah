type Mode = "in_person" | "remote" | "both";
const sub = (name: string, icon: string, deliveryMode: Mode, coinPrice: number, description: string) => ({ name, icon, deliveryMode, coinPrice, description });

export const deliveryModeLabels: Record<Mode, string> = { in_person: "حضوري", remote: "عن بُعد", both: "حضوري وعن بُعد" };

export const suggestedServices = [
  { name: "السباكة", icon: "Droplets", color: "blue", coinPrice: 5, description: "إصلاح وتركيب جميع أعمال السباكة المنزلية والتجارية.", subs: [
    sub("كشف التسربات", "Droplets", "in_person", 6, "تحديد مصدر تسرب المياه بدقة."),
    sub("تركيب الأدوات الصحية", "Wrench", "in_person", 5, "تركيب المغاسل والخلاطات والمراحيض."),
    sub("تسليك المجاري", "Wrench", "in_person", 5, "فتح انسدادات الصرف."),
    sub("استشارة سباكة", "Headset", "remote", 2, "استشارة فنية قبل الشراء أو الإصلاح."),
  ] },
  { name: "الكهرباء", icon: "Zap", color: "gold", coinPrice: 5, description: "أعمال الكهرباء والتمديدات والإنارة بأعلى معايير السلامة.", subs: [
    sub("تمديدات كهربائية", "Plug", "in_person", 6, "تمديد وصيانة الأسلاك والمقابس."),
    sub("تركيب الإنارة", "Lightbulb", "in_person", 4, "تركيب الثريات والإنارة الحديثة."),
    sub("صيانة اللوحات والقواطع", "Zap", "in_person", 6, "فحص وإصلاح لوحة التوزيع."),
    sub("استشارة كهربائية", "Headset", "remote", 2, "توجيه فني عن بُعد."),
  ] },
  { name: "التكييف", icon: "AirVent", color: "teal", coinPrice: 6, description: "تركيب وصيانة وتنظيف أجهزة التكييف.", subs: [
    sub("تنظيف المكيفات", "Sparkles", "in_person", 5, "غسيل وتنظيف شامل للمكيف."),
    sub("تعبئة الفريون", "AirVent", "in_person", 6, "فحص وتعبئة غاز التبريد."),
    sub("تركيب المكيفات", "Wrench", "in_person", 7, "فك وتركيب جميع الأنواع."),
  ] },
  { name: "الصيانة", icon: "Hammer", color: "graphite", coinPrice: 5, description: "دهانات ونجارة وتشطيبات بلمسة احترافية.", subs: [
    sub("دهانات", "Paintbrush", "in_person", 6, "دهانات داخلية وخارجية."),
    sub("نجارة", "Hammer", "in_person", 5, "تركيب وإصلاح الأبواب والأثاث."),
    sub("تركيب الأثاث", "Sofa", "in_person", 4, "فك وتركيب الأثاث المنزلي."),
  ] },
  { name: "التعليم", icon: "GraduationCap", color: "emerald", coinPrice: 4, description: "معلمون متخصصون لجميع المراحل الدراسية.", subs: [
    sub("رياضيات", "Calculator", "both", 4, "شرح وحل التمارين."),
    sub("لغة إنجليزية", "Languages", "both", 4, "محادثة وقواعد."),
    sub("فيزياء وكيمياء", "FlaskConical", "both", 4, "دروس العلوم للمرحلة الثانوية."),
    sub("تأسيس قراءة وكتابة", "BookOpen", "both", 3, "تأسيس الطلاب في المرحلة الابتدائية."),
  ] },
  { name: "الخدمات الإدارية", icon: "BriefcaseBusiness", color: "ruby", coinPrice: 5, description: "خدمات إدارية وقانونية ومحاسبية للأفراد والشركات.", subs: [
    sub("محاسبة ومسك دفاتر", "ChartNoAxesCombined", "remote", 6, "إعداد القوائم المالية."),
    sub("استشارة قانونية", "Scale", "remote", 6, "استشارة من مختص قانوني."),
    sub("إعداد السير الذاتية", "FileText", "remote", 3, "سيرة ذاتية احترافية."),
    sub("خدمات تعقيب", "ClipboardList", "in_person", 5, "إنجاز المعاملات الحكومية."),
  ] },
  { name: "التقنية", icon: "Monitor", color: "blue", coinPrice: 6, description: "حلول تقنية وبرمجية وصيانة الأجهزة.", subs: [
    sub("صيانة الحاسب", "Laptop", "both", 5, "إصلاح الأعطال وتسريع الأجهزة."),
    sub("تطوير المواقع والتطبيقات", "CodeXml", "remote", 8, "تصميم وبرمجة احترافية."),
    sub("الشبكات والواي فاي", "Wifi", "in_person", 5, "تمديد وضبط الشبكات."),
    sub("كاميرات المراقبة", "Camera", "in_person", 6, "تركيب وبرمجة الكاميرات."),
  ] },
  { name: "الزراعة", icon: "Sprout", color: "emerald", coinPrice: 5, description: "تنسيق الحدائق والعناية بالمزروعات.", subs: [
    sub("تنسيق الحدائق", "Flower2", "in_person", 6, "تصميم وتنسيق المساحات الخضراء."),
    sub("تقليم الأشجار", "Trees", "in_person", 4, "قص وتشذيب الأشجار."),
    sub("شبكات الري", "Droplets", "in_person", 5, "تركيب وصيانة أنظمة الري."),
    sub("استشارة زراعية", "Leaf", "remote", 2, "توجيه مختص زراعي."),
  ] },
  { name: "النظافة", icon: "BrushCleaning", color: "teal", coinPrice: 4, description: "نظافة شاملة للمنازل والمكاتب.", subs: [
    sub("تنظيف المنازل", "BrushCleaning", "in_person", 4, "تنظيف شامل ودوري."),
    sub("تنظيف الكنب والسجاد", "Sofa", "in_person", 4, "غسيل بالبخار."),
    sub("مكافحة الحشرات", "ShieldCheck", "in_person", 5, "رش ومكافحة آمنة."),
  ] },
  { name: "السيارات", icon: "Car", color: "graphite", coinPrice: 5, description: "صيانة وخدمات السيارات في موقعك.", subs: [
    sub("غسيل وتلميع", "Sparkles", "in_person", 3, "غسيل متنقل وتلميع."),
    sub("كهرباء السيارات", "Zap", "in_person", 5, "فحص البطارية والأعطال."),
    sub("بنشر متنقل", "Car", "in_person", 4, "إصلاح وتبديل الإطارات."),
  ] },
];
