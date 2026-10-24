import 'package:flutter/material.dart';

import 'theme.dart';

// Formatting uses Latin digits with Arabic labels (same rule as the web apps).

String two(int n) => n.toString().padLeft(2, '0');

const _months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const weekdays = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];

String fmtTime(DateTime d) {
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  return '$h:${two(d.minute)} ${d.hour < 12 ? 'ص' : 'م'}';
}

String fmtDate(DateTime? d) => d == null ? '—' : '${d.day} ${_months[d.month - 1]} ${d.year}';
String fmtDateTime(DateTime? d) => d == null ? '—' : '${fmtDate(d)} • ${fmtTime(d)}';
String fmtShortDate(DateTime d) => '${d.year}/${two(d.month)}/${two(d.day)}';

String timeAgo(DateTime? d) {
  if (d == null) return '';
  final diff = DateTime.now().difference(d);
  if (diff.inSeconds < 60) return 'الآن';
  if (diff.inMinutes < 60) return 'قبل ${diff.inMinutes} د';
  if (diff.inHours < 24) return 'قبل ${diff.inHours} س';
  if (diff.inDays < 7) return 'قبل ${diff.inDays} يوم';
  return fmtDate(d);
}

String fmtNum(num n) {
  final s = n is int || n == n.roundToDouble() ? n.round().toString() : n.toStringAsFixed(1);
  return s.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => ',');
}

String modeLabel(String mode) => mode == 'remote' ? 'عن بُعد' : 'حضوري';

String statusLabel(String status, {String mode = 'in_person', bool provider = false}) {
  switch (status) {
    case 'pending':
      return provider ? 'جديد' : 'بانتظار مقدم خدمة';
    case 'accepted':
      return provider ? (mode == 'remote' ? 'مقبول' : 'في الطريق') : (mode == 'remote' ? 'تم القبول' : 'مقدم الخدمة في الطريق');
    case 'arrived':
      return provider ? 'وصلت' : 'وصل مقدم الخدمة';
    case 'in_progress':
      return 'جارٍ التنفيذ';
    case 'completed':
      return 'مكتمل';
    case 'cancelled':
      return 'ملغي';
  }
  return status;
}

Color statusColor(String status) {
  switch (status) {
    case 'pending':
      return Brand.warning;
    case 'accepted':
    case 'arrived':
      return Brand.primary;
    case 'in_progress':
      return Brand.sky;
    case 'completed':
      return Brand.success;
    case 'cancelled':
      return Brand.danger;
  }
  return Brand.mutedFg;
}

IconData statusIcon(String status) {
  switch (status) {
    case 'pending':
      return Icons.hourglass_top_rounded;
    case 'accepted':
      return Icons.directions_car_rounded;
    case 'arrived':
      return Icons.door_front_door_rounded;
    case 'in_progress':
      return Icons.handyman_rounded;
    case 'completed':
      return Icons.check_circle_rounded;
    case 'cancelled':
      return Icons.cancel_rounded;
  }
  return Icons.info_rounded;
}

/// Steps shown in the order timeline (remote orders skip "arrived").
List<String> statusSteps(String mode) =>
    mode == 'remote' ? const ['pending', 'accepted', 'in_progress', 'completed'] : const ['pending', 'accepted', 'arrived', 'in_progress', 'completed'];
