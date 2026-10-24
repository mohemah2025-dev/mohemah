import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'models.dart';

const defaultRegions = ['الرياض', 'جدة', 'مكة', 'المدينة', 'بريدة', 'الدمام', 'الخبر', 'أبها', 'تبوك', 'حائل', 'جازان', 'نجران', 'الطائف', 'الأحساء', 'الجوف', 'عرعر', 'الباحة'];

/// Services, ads, policies and settings from `/api/public/bootstrap`, cached for offline starts.
class PublicData extends ChangeNotifier {
  PublicData(this.api);
  final Api api;

  Map<String, dynamic> _raw = const {};
  bool loaded = false;
  String? error;

  static const _cacheKey = 'mohemah.bootstrap';

  AppSettings get settings => AppSettings(jMap(_raw['settings']));
  List<Service> get services => jList(_raw['services']).map(Service.new).toList();
  List<SubService> get subServices => jList(_raw['sub_services']).map(SubService.new).toList();
  List<Ad> get ads => jList(_raw['ads']).map(Ad.new).toList();
  List<Policy> get policies => jList(_raw['policies']).map(Policy.new).toList();
  List<String> get regions {
    final r = jStrings(_raw['regions']);
    return r.isEmpty ? defaultRegions : r;
  }

  List<SubService> subsOf(String serviceId) => subServices.where((s) => s.serviceId == serviceId).toList();
  Service? serviceById(String? id) {
    for (final s in services) {
      if (s.id == id) return s;
    }
    return null;
  }

  List<Policy> policiesFor(String audience) => policies.where((p) => p.audience == 'all' || p.audience == audience).toList();

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    if (!loaded) {
      final cached = prefs.getString(_cacheKey);
      if (cached != null) {
        try {
          _raw = jMap(jsonDecode(cached));
          loaded = true;
          notifyListeners();
        } catch (_) {}
      }
    }
    try {
      final res = await api.get('/api/public/bootstrap');
      _raw = jMap(res);
      loaded = true;
      error = null;
      await prefs.setString(_cacheKey, jsonEncode(_raw));
    } catch (e) {
      error = errMsg(e);
    }
    notifyListeners();
  }
}

class PublicScope extends InheritedNotifier<PublicData> {
  const PublicScope({super.key, required PublicData data, required super.child}) : super(notifier: data);
  static PublicData of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<PublicScope>()!.notifier!;
}
