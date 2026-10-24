import 'package:flutter/material.dart';

/// Service icon keys stored by the dashboard (lucide names) mapped to Material icons.
const Map<String, IconData> serviceIconMap = {
  'Wrench': Icons.build_rounded,
  'Droplets': Icons.water_drop_rounded,
  'Zap': Icons.bolt_rounded,
  'Plug': Icons.power_rounded,
  'Lightbulb': Icons.lightbulb_rounded,
  'AirVent': Icons.ac_unit_rounded,
  'Hammer': Icons.handyman_rounded,
  'Paintbrush': Icons.format_paint_rounded,
  'Ruler': Icons.straighten_rounded,
  'HardHat': Icons.engineering_rounded,
  'Building2': Icons.apartment_rounded,
  'Sofa': Icons.chair_rounded,
  'KeyRound': Icons.key_rounded,
  'ShieldCheck': Icons.verified_user_rounded,
  'GraduationCap': Icons.school_rounded,
  'BookOpen': Icons.menu_book_rounded,
  'NotebookPen': Icons.edit_note_rounded,
  'Calculator': Icons.calculate_rounded,
  'Languages': Icons.translate_rounded,
  'FlaskConical': Icons.science_rounded,
  'Microscope': Icons.biotech_rounded,
  'BriefcaseBusiness': Icons.business_center_rounded,
  'ClipboardList': Icons.assignment_rounded,
  'FileText': Icons.description_rounded,
  'ChartNoAxesCombined': Icons.insights_rounded,
  'Scale': Icons.balance_rounded,
  'Landmark': Icons.account_balance_rounded,
  'Handshake': Icons.handshake_rounded,
  'Monitor': Icons.desktop_windows_rounded,
  'Laptop': Icons.laptop_rounded,
  'CodeXml': Icons.code_rounded,
  'Database': Icons.storage_rounded,
  'Network': Icons.lan_rounded,
  'Wifi': Icons.wifi_rounded,
  'Smartphone': Icons.smartphone_rounded,
  'Cpu': Icons.memory_rounded,
  'Camera': Icons.photo_camera_rounded,
  'Printer': Icons.print_rounded,
  'Sprout': Icons.spa_rounded,
  'Tractor': Icons.agriculture_rounded,
  'Trees': Icons.park_rounded,
  'Flower2': Icons.local_florist_rounded,
  'Leaf': Icons.eco_rounded,
  'Wheat': Icons.grass_rounded,
  'Shovel': Icons.hardware_rounded,
  'Fence': Icons.fence_rounded,
  'HeartPulse': Icons.monitor_heart_rounded,
  'Stethoscope': Icons.medical_services_rounded,
  'CookingPot': Icons.soup_kitchen_rounded,
  'Utensils': Icons.restaurant_rounded,
  'Scissors': Icons.content_cut_rounded,
  'Shirt': Icons.checkroom_rounded,
  'Car': Icons.directions_car_rounded,
  'Truck': Icons.local_shipping_rounded,
  'Package': Icons.inventory_2_rounded,
  'Sparkles': Icons.auto_awesome_rounded,
  'BrushCleaning': Icons.cleaning_services_rounded,
  'Headset': Icons.headset_mic_rounded,
  'Settings': Icons.settings_rounded,
  'PenTool': Icons.design_services_rounded,
  'Megaphone': Icons.campaign_rounded,
  'Globe': Icons.language_rounded,
  'Dog': Icons.pets_rounded,
  'Bike': Icons.pedal_bike_rounded,
  'Accessibility': Icons.accessibility_new_rounded,
};

const Map<String, String> _legacyEmoji = {
  '🛠️': 'Wrench', '🔧': 'Wrench', '⚡': 'Zap', '🚰': 'Droplets', '🧹': 'BrushCleaning', '❄️': 'AirVent', '🌿': 'Sprout',
  '🎓': 'GraduationCap', '💻': 'Monitor', '🎨': 'Paintbrush', '🪵': 'Hammer', '👷': 'HardHat', '🪟': 'Building2',
  '✍️': 'NotebookPen', '🌐': 'Globe', '📢': 'Megaphone', '📸': 'Camera', '🍳': 'CookingPot', '🍰': 'Utensils',
  '🥖': 'Utensils', '🚗': 'Car', '🔩': 'Wrench', '🛞': 'Car', '📋': 'ClipboardList',
};

IconData serviceIcon(String? key) => serviceIconMap[_legacyEmoji[key] ?? key] ?? Icons.build_rounded;

/// Semantic palette keys used by service records: (foreground, soft background).
(Color, Color) serviceColors(String? key) {
  switch (key) {
    case 'emerald':
      return (const Color(0xFF12946B), const Color(0xFFE3F6EE));
    case 'gold':
      return (const Color(0xFFB7820F), const Color(0xFFFBF1DA));
    case 'ruby':
      return (const Color(0xFFB23A48), const Color(0xFFF8E3E6));
    case 'teal':
      return (const Color(0xFF138A96), const Color(0xFFDDF3F5));
    case 'graphite':
      return (const Color(0xFF4A5468), const Color(0xFFE9ECF1));
    default:
      return (const Color(0xFF3D70D1), const Color(0xFFE5EDFB));
  }
}

class ServiceIcon extends StatelessWidget {
  const ServiceIcon({super.key, this.icon, this.color, this.size = 48});
  final String? icon;
  final String? color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final (fg, bg) = serviceColors(color);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(size * 0.32)),
      alignment: Alignment.center,
      child: Icon(serviceIcon(icon), color: fg, size: size * 0.52),
    );
  }
}
