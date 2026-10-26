import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:http/http.dart' as http;

import 'public_data.dart';
import 'theme.dart';
import 'widgets.dart';

/// Google Maps key passed at build time (`--dart-define=GOOGLE_MAPS_KEY=...`).
/// Without it the "choose on map" button is hidden; "my location" still works.
const _mapsKey = String.fromEnvironment('GOOGLE_MAPS_KEY');
bool get mapsEnabled => _mapsKey.isNotEmpty;

/// A place chosen by GPS or on the map, with the address filled in from the coordinates.
class PickedLocation {
  const PickedLocation({required this.lat, required this.lng, required this.address, this.region});
  final double lat;
  final double lng;
  final String address;

  /// One of the app's cities when the place is inside one of them.
  final String? region;
}

// English names returned by some devices → the app's city names.
const _cityAliases = {
  'riyadh': 'الرياض', 'jeddah': 'جدة', 'jiddah': 'جدة', 'mecca': 'مكة', 'makkah': 'مكة', 'medina': 'المدينة', 'madinah': 'المدينة',
  'buraydah': 'بريدة', 'buraidah': 'بريدة', 'dammam': 'الدمام', 'khobar': 'الخبر', 'al khobar': 'الخبر', 'abha': 'أبها', 'tabuk': 'تبوك',
  'hail': 'حائل', "ha'il": 'حائل', 'jazan': 'جازان', 'jizan': 'جازان', 'najran': 'نجران', 'taif': 'الطائف', 'al hofuf': 'الأحساء',
  'hofuf': 'الأحساء', 'al ahsa': 'الأحساء', 'al-ahsa': 'الأحساء', 'sakaka': 'الجوف', 'al jawf': 'الجوف', 'arar': 'عرعر', 'al bahah': 'الباحة', 'baha': 'الباحة',
};

String? _matchRegion(List<String> regions, Iterable<String?> names) {
  for (final raw in names) {
    final n = (raw ?? '').trim();
    if (n.isEmpty) continue;
    for (final r in regions) {
      if (n.contains(r) || r.contains(n)) return r;
    }
    final lower = n.toLowerCase();
    for (final e in _cityAliases.entries) {
      if (lower.contains(e.key) && regions.contains(e.value)) return e.value;
    }
  }
  return null;
}

/// Turns coordinates into a readable Arabic address and the matching city
/// (OpenStreetMap reverse geocoding: free, no key, no native plugin).
Future<PickedLocation> describeLocation(double lat, double lng, List<String> regions) async {
  try {
    final uri = Uri.parse('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=ar&lat=$lat&lon=$lng');
    final res = await http.get(uri, headers: {'User-Agent': 'MohemahApp/1.0 (sa.mohemah)'}).timeout(const Duration(seconds: 12));
    if (res.statusCode == 200) {
      final data = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      final a = (data['address'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
      String? v(String k) => (a[k] as String?)?.trim();
      final parts = <String>[];
      for (final x in [v('neighbourhood') ?? v('suburb') ?? v('quarter'), v('road'), v('house_number')]) {
        if (x != null && x.isNotEmpty && !parts.contains(x)) parts.add(x);
      }
      final city = v('city') ?? v('town') ?? v('village');
      final region = _matchRegion(regions, [city, v('county'), v('state'), data['display_name'] as String?]);
      if (city != null && city.isNotEmpty) parts.add(city);
      if (parts.isNotEmpty) return PickedLocation(lat: lat, lng: lng, address: parts.join('، '), region: region);
      return PickedLocation(lat: lat, lng: lng, address: (data['display_name'] ?? '$lat, $lng').toString(), region: region);
    }
  } catch (_) {}
  return PickedLocation(lat: lat, lng: lng, address: '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}');
}

/// Current GPS position (asks for permission). Shows a message and returns null on failure.
Future<Position?> currentPosition(BuildContext context) async {
  try {
    if (!await Geolocator.isLocationServiceEnabled()) {
      if (context.mounted) showSnack(context, 'فعّل خدمة الموقع (GPS) في الجوال', error: true);
      return null;
    }
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      if (context.mounted) showSnack(context, 'اسمح للتطبيق بالوصول للموقع من إعدادات الجوال', error: true);
      return null;
    }
    return await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20)));
  } catch (_) {
    if (context.mounted) showSnack(context, 'تعذّر تحديد موقعك، حاول مجدداً', error: true);
    return null;
  }
}

/// Current place without any prompt: only when location is on and permission was already given.
Future<PickedLocation?> quietCurrentLocation(List<String> regions) async {
  try {
    if (!await Geolocator.isLocationServiceEnabled()) return null;
    final perm = await Geolocator.checkPermission();
    if (perm != LocationPermission.always && perm != LocationPermission.whileInUse) return null;
    final pos = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium, timeLimit: Duration(seconds: 15)));
    return describeLocation(pos.latitude, pos.longitude, regions);
  } catch (_) {
    return null;
  }
}

/// Two buttons: "my current location" and "choose on Google Maps". Calls [onPicked] with the filled data.
class LocationPicker extends StatefulWidget {
  const LocationPicker({super.key, required this.onPicked, this.picked});
  final ValueChanged<PickedLocation> onPicked;
  final PickedLocation? picked;

  @override
  State<LocationPicker> createState() => _LocationPickerState();
}

class _LocationPickerState extends State<LocationPicker> {
  bool _busy = false;

  Future<void> _useGps() async {
    setState(() => _busy = true);
    final regions = PublicScope.of(context).regions;
    final pos = await currentPosition(context);
    if (pos != null) {
      final loc = await describeLocation(pos.latitude, pos.longitude, regions);
      widget.onPicked(loc);
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _useMap() async {
    final loc = await Navigator.push<PickedLocation>(context, MaterialPageRoute(builder: (_) => MapPickerPage(initial: widget.picked)));
    if (loc != null) widget.onPicked(loc);
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.picked;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _busy ? null : _useGps,
              icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.my_location_outlined),
              label: const Text('تحديد موقعي'),
            ),
          ),
          if (mapsEnabled) ...[
            const SizedBox(width: 8),
            Expanded(child: OutlinedButton.icon(onPressed: _useMap, icon: const Icon(Icons.map_outlined), label: const Text('من الخريطة'))),
          ],
        ]),
        if (p != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(children: [
              const Icon(Icons.check_circle_outlined, color: Brand.success, size: 16),
              const SizedBox(width: 4),
              Expanded(child: Text('تم تحديد الموقع${p.region != null ? ' • ${p.region}' : ''}', style: const TextStyle(fontSize: 12, color: Brand.success))),
            ]),
          ),
      ]),
    );
  }
}

/// Full-screen Google Map with a fixed pin in the middle; the user moves the map under it.
class MapPickerPage extends StatefulWidget {
  const MapPickerPage({super.key, this.initial});
  final PickedLocation? initial;
  @override
  State<MapPickerPage> createState() => _MapPickerPageState();
}

class _MapPickerPageState extends State<MapPickerPage> {
  static const _riyadh = LatLng(24.7136, 46.6753);
  late LatLng _center = widget.initial == null ? _riyadh : LatLng(widget.initial!.lat, widget.initial!.lng);
  GoogleMapController? _map;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (widget.initial == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _goToMe());
    }
  }

  Future<void> _goToMe() async {
    final pos = await currentPosition(context);
    if (pos == null) return;
    _center = LatLng(pos.latitude, pos.longitude);
    await _map?.animateCamera(CameraUpdate.newLatLngZoom(_center, 16));
  }

  Future<void> _confirm() async {
    setState(() => _busy = true);
    final loc = await describeLocation(_center.latitude, _center.longitude, PublicScope.of(context).regions);
    if (mounted) Navigator.pop(context, loc);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('حدد الموقع على الخريطة')),
      body: Stack(children: [
        GoogleMap(
          initialCameraPosition: CameraPosition(target: _center, zoom: widget.initial == null ? 11 : 16),
          onMapCreated: (c) => _map = c,
          onCameraMove: (p) => _center = p.target,
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          mapToolbarEnabled: false,
        ),
        const IgnorePointer(
          child: Center(
            child: Padding(
              padding: EdgeInsets.only(bottom: 44),
              child: Icon(Icons.location_on_outlined, size: 52, color: Brand.danger),
            ),
          ),
        ),
        Positioned(
          left: 16,
          bottom: 100,
          child: FloatingActionButton.small(heroTag: 'me', onPressed: _goToMe, backgroundColor: Colors.white, child: const Icon(Icons.my_location_outlined, color: Brand.primary)),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 24,
          child: SafeArea(
            top: false,
            child: FilledButton.icon(
              onPressed: _busy ? null : _confirm,
              icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.check_outlined),
              label: const Text('تأكيد هذا الموقع'),
            ),
          ),
        ),
      ]),
    );
  }
}

/// "Current location" line for the home headers (both apps): the real GPS place (neighbourhood,
/// street, city), asked once on first open; tapping refreshes it.
class CurrentLocationLine extends StatefulWidget {
  const CurrentLocationLine({super.key, this.fallback});
  final String? fallback;
  static final ValueNotifier<PickedLocation?> place = ValueNotifier(null);
  static bool _asked = false;

  @override
  State<CurrentLocationLine> createState() => _CurrentLocationLineState();
}

class _CurrentLocationLineState extends State<CurrentLocationLine> {
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (CurrentLocationLine.place.value == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted) return;
        final loc = await quietCurrentLocation(PublicScope.of(context).regions);
        if (loc != null) {
          CurrentLocationLine.place.value = loc;
        } else if (!CurrentLocationLine._asked && mounted) {
          // First open: ask for permission once so the header shows the real current place.
          CurrentLocationLine._asked = true;
          await _locate();
        }
      });
    }
  }

  Future<void> _locate() async {
    setState(() => _busy = true);
    final regions = PublicScope.of(context).regions;
    final pos = await currentPosition(context);
    if (pos != null) CurrentLocationLine.place.value = await describeLocation(pos.latitude, pos.longitude, regions);
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<PickedLocation?>(
      valueListenable: CurrentLocationLine.place,
      builder: (context, loc, _) => InkWell(
        onTap: _busy ? null : _locate,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(children: [
            _busy
                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Icon(loc == null ? Icons.my_location_outlined : Icons.location_on_outlined, size: 15),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                loc?.address ?? (widget.fallback != null ? '${widget.fallback} • حدّد موقعك الحالي' : 'حدّد موقعك الحالي'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12.5, color: Colors.white.withValues(alpha: 0.9)),
              ),
            ),
            const SizedBox(width: 2),
            Icon(Icons.keyboard_arrow_down_outlined, size: 16, color: Colors.white.withValues(alpha: 0.9)),
          ]),
        ),
      ),
    );
  }
}
