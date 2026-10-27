import 'package:flutter/material.dart' hide Text;

import 'i18n.dart';

/// Service icon keys stored by the dashboard (lucide names) mapped to Material icons.
const Map<String, IconData> serviceIconMap = {
  'Wrench': Icons.build_outlined,
  'Droplets': Icons.water_drop_outlined,
  'Zap': Icons.bolt_outlined,
  'Plug': Icons.power_outlined,
  'Lightbulb': Icons.lightbulb_outlined,
  'AirVent': Icons.ac_unit_outlined,
  'Hammer': Icons.handyman_outlined,
  'Paintbrush': Icons.format_paint_outlined,
  'Ruler': Icons.straighten_outlined,
  'HardHat': Icons.engineering_outlined,
  'Building2': Icons.apartment_outlined,
  'Sofa': Icons.chair_outlined,
  'KeyRound': Icons.key_outlined,
  'ShieldCheck': Icons.verified_user_outlined,
  'GraduationCap': Icons.school_outlined,
  'BookOpen': Icons.menu_book_outlined,
  'NotebookPen': Icons.edit_note_outlined,
  'Calculator': Icons.calculate_outlined,
  'Languages': Icons.translate_outlined,
  'FlaskConical': Icons.science_outlined,
  'Microscope': Icons.biotech_outlined,
  'BriefcaseBusiness': Icons.business_center_outlined,
  'ClipboardList': Icons.assignment_outlined,
  'FileText': Icons.description_outlined,
  'ChartNoAxesCombined': Icons.insights_outlined,
  'Scale': Icons.balance_outlined,
  'Landmark': Icons.account_balance_outlined,
  'Handshake': Icons.handshake_outlined,
  'Monitor': Icons.desktop_windows_outlined,
  'Laptop': Icons.laptop_outlined,
  'CodeXml': Icons.code_outlined,
  'Database': Icons.storage_outlined,
  'Network': Icons.lan_outlined,
  'Wifi': Icons.wifi_outlined,
  'Smartphone': Icons.smartphone_outlined,
  'Cpu': Icons.memory_outlined,
  'Camera': Icons.photo_camera_outlined,
  'Printer': Icons.print_outlined,
  'Sprout': Icons.spa_outlined,
  'Tractor': Icons.agriculture_outlined,
  'Trees': Icons.park_outlined,
  'Flower2': Icons.local_florist_outlined,
  'Leaf': Icons.eco_outlined,
  'Wheat': Icons.grass_outlined,
  'Shovel': Icons.hardware_outlined,
  'Fence': Icons.fence_outlined,
  'HeartPulse': Icons.monitor_heart_outlined,
  'Stethoscope': Icons.medical_services_outlined,
  'CookingPot': Icons.soup_kitchen_outlined,
  'Utensils': Icons.restaurant_outlined,
  'Scissors': Icons.content_cut_outlined,
  'Shirt': Icons.checkroom_outlined,
  'Car': Icons.directions_car_outlined,
  'Truck': Icons.local_shipping_outlined,
  'Package': Icons.inventory_2_outlined,
  'Sparkles': Icons.auto_awesome_outlined,
  'BrushCleaning': Icons.cleaning_services_outlined,
  'Headset': Icons.headset_mic_outlined,
  'Settings': Icons.settings_outlined,
  'PenTool': Icons.design_services_outlined,
  'Megaphone': Icons.campaign_outlined,
  'Globe': Icons.language_outlined,
  'Dog': Icons.pets_outlined,
  'Bike': Icons.pedal_bike_outlined,
  'Accessibility': Icons.accessibility_new_outlined,
  'Bath': Icons.bathtub_outlined,
  'ShowerHead': Icons.shower_outlined,
  'Refrigerator': Icons.kitchen_outlined,
  'WashingMachine': Icons.local_laundry_service_outlined,
  'Microwave': Icons.microwave_outlined,
  'Tv': Icons.tv_outlined,
  'Fan': Icons.mode_fan_off_outlined,
  'Heater': Icons.fireplace_outlined,
  'DoorOpen': Icons.door_front_door_outlined,
  'Blinds': Icons.blinds_outlined,
  'Drill': Icons.carpenter_outlined,
  'PaintRoller': Icons.format_paint_outlined,
  'SprayCan': Icons.sanitizer_outlined,
  'Recycle': Icons.recycling_outlined,
  'Bug': Icons.pest_control_outlined,
  'Baby': Icons.child_care_outlined,
  'Users': Icons.groups_outlined,
  'Dumbbell': Icons.fitness_center_outlined,
  'Music': Icons.music_note_outlined,
  'Palette': Icons.palette_outlined,
  'Video': Icons.videocam_outlined,
  'Plane': Icons.flight_outlined,
  'Bus': Icons.directions_bus_outlined,
  'Fuel': Icons.local_gas_station_outlined,
  'Warehouse': Icons.warehouse_outlined,
  'Store': Icons.storefront_outlined,
  'Cake': Icons.cake_outlined,
  'Pill': Icons.medication_outlined,
  'Glasses': Icons.visibility_outlined,
  'Snowflake': Icons.ac_unit_outlined,
  'Flame': Icons.local_fire_department_outlined,
  'Battery': Icons.battery_charging_full_outlined,
  'Server': Icons.dns_outlined,
  'Lock': Icons.lock_outlined,
  'Construction': Icons.construction_outlined,
  'Waves': Icons.waves_outlined,
  'Brain': Icons.psychology_outlined,
  'HandHeart': Icons.volunteer_activism_outlined,
  'ChefHat': Icons.restaurant_menu_outlined,
  'Thermometer': Icons.thermostat_outlined,
  'Forklift': Icons.forklift,
  'BrickWall': Icons.roofing_outlined,
  'LampCeiling': Icons.light_outlined,
  'BedDouble': Icons.bed_outlined,
  'PawPrint': Icons.pets_outlined,
  'Gamepad2': Icons.sports_esports_outlined,
  'Award': Icons.workspace_premium_outlined,
  'Satellite': Icons.satellite_alt_outlined,
};

const Map<String, String> _legacyEmoji = {
  '🛠️': 'Wrench', '🔧': 'Wrench', '⚡': 'Zap', '🚰': 'Droplets', '🧹': 'BrushCleaning', '❄️': 'AirVent', '🌿': 'Sprout',
  '🎓': 'GraduationCap', '💻': 'Monitor', '🎨': 'Paintbrush', '🪵': 'Hammer', '👷': 'HardHat', '🪟': 'Building2',
  '✍️': 'NotebookPen', '🌐': 'Globe', '📢': 'Megaphone', '📸': 'Camera', '🍳': 'CookingPot', '🍰': 'Utensils',
  '🥖': 'Utensils', '🚗': 'Car', '🔩': 'Wrench', '🛞': 'Car', '📋': 'ClipboardList',
};

IconData serviceIcon(String? key) => serviceIconMap[_legacyEmoji[key] ?? key] ?? Icons.build_outlined;

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
