import 'dart:async';

import 'package:flutter/material.dart' hide Text;
import 'package:shared_preferences/shared_preferences.dart';

import 'i18n.dart';

import 'config.dart';
import 'models.dart';
import 'public_data.dart';
import 'session.dart';
import 'theme.dart';
import 'widgets.dart';

/// Exact ratios of the admin ad sizes, so the apps show the image like the admin preview (no stretching):
/// top banner 1200×400 (3:1), bottom banner 1200×300 (4:1), popup card 800×600 (4:3).
double adAspect(String? placement) => switch (placement) {
      'bottom_banner' => 4.0,
      'popup_card' => 4 / 3,
      _ => 3.0,
    };

List<Ad> _adsOf(BuildContext context, String placement) {
  final scope = context.dependOnInheritedWidgetOfExactType<PublicScope>();
  final all = scope?.notifier?.ads ?? const <Ad>[];
  return all.where((a) => (a.placement ?? 'top_banner') == placement).toList();
}

class _AdImage extends StatelessWidget {
  const _AdImage({required this.ad, this.radius = 18});
  final Ad ad;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final img = (ad.imageUrl ?? '').isEmpty
        ? Container(
            decoration: const BoxDecoration(gradient: Brand.gradient),
            padding: const EdgeInsets.symmetric(horizontal: 18),
            alignment: AlignmentDirectional.centerStart,
            child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
              if ((ad.sponsor ?? '').isNotEmpty) Text(ad.sponsor!, style: const TextStyle(color: Colors.white70, fontSize: 12)),
              Text(ad.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
            ]),
          )
        : Image.network(
            absUrl(ad.imageUrl!),
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
            errorBuilder: (_, __, ___) => Container(color: Brand.muted, alignment: Alignment.center, child: Text(ad.title, style: const TextStyle(fontWeight: FontWeight.w700))),
          );
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Material(
        color: Colors.transparent,
        child: InkWell(onTap: (ad.link ?? '').startsWith('http') ? () => openUrl(context, ad.link!) : null, child: img),
      ),
    );
  }
}

/// Auto-sliding ad space for one placement, drawn at the placement's exact ratio. Hidden when there are no ads.
class AdBanner extends StatefulWidget {
  const AdBanner({super.key, this.placement = 'top_banner', this.padding = EdgeInsets.zero});
  final String placement;
  final EdgeInsetsGeometry padding;
  @override
  State<AdBanner> createState() => _AdBannerState();
}

class _AdBannerState extends State<AdBanner> {
  final _page = PageController();
  Timer? _timer;
  int _index = 0;

  @override
  void dispose() {
    _timer?.cancel();
    _page.dispose();
    super.dispose();
  }

  void _arm(int count) {
    if (count < 2) {
      _timer?.cancel();
      _timer = null;
      return;
    }
    _timer ??= Timer.periodic(const Duration(seconds: 5), (_) {
      if (!_page.hasClients) return;
      _page.animateToPage((_index + 1) % count, duration: const Duration(milliseconds: 500), curve: Curves.easeOutCubic);
    });
  }

  @override
  Widget build(BuildContext context) {
    final ads = _adsOf(context, widget.placement);
    _arm(ads.length);
    if (ads.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: widget.padding,
      child: Column(children: [
        AspectRatio(
          aspectRatio: adAspect(widget.placement),
          child: PageView.builder(
            controller: _page,
            itemCount: ads.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (_, i) => _AdImage(ad: ads[i], radius: widget.placement == 'bottom_banner' ? 14 : 18),
          ),
        ),
        if (ads.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var i = 0; i < ads.length; i++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _index ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(color: i == _index ? Brand.primary : Brand.border, borderRadius: BorderRadius.circular(6)),
                ),
            ]),
          ),
      ]),
    );
  }
}

/// Shows the popup-card ad (4:3): general popups once per app launch; welcome popups (new members) once per user,
/// with «receive the gift» when the administration attached coins or a free subscription. Draws nothing itself.
class PopupAdHost extends StatefulWidget {
  const PopupAdHost({super.key});
  @override
  State<PopupAdHost> createState() => _PopupAdHostState();
}

class _PopupAdHostState extends State<PopupAdHost> {
  static bool _shownGeneral = false;
  static final Set<String> _handled = {};
  bool _busy = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final session = SessionScope.of(context);
    final ads = _adsOf(context, 'popup_card').where((a) => a.app == 'all' || a.app == session.app.name).toList();
    if (ads.isEmpty || _busy) return;
    final profile = session.profile;
    final created = profile?.createdAt;
    // Welcome ad for a member who registered within the ad's period.
    final welcome = ads.where((a) => a.audience == 'new_users' && !_handled.contains(a.id) && profile != null && created != null &&
        DateTime.now().difference(created).inDays < a.newDays).toList();
    if (welcome.isNotEmpty) {
      final ad = welcome.first;
      _handled.add(ad.id);
      _busy = true;
      unawaited(_showWelcome(ad, profile!.id));
      return;
    }
    if (_shownGeneral) return;
    final general = ads.where((a) => a.audience != 'new_users').toList();
    if (general.isEmpty) return;
    _shownGeneral = true;
    final ad = general.first;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _show(ad, null);
    });
  }

  Future<void> _showWelcome(Ad ad, String userId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = 'welcome_ad_${ad.id}_$userId';
      if (prefs.getBool(key) == true || !mounted) return;
      await prefs.setBool(key, true);
      await _show(ad, ad.giftKind != 'none' && ad.giftValue > 0 && SessionScope.read(context).app == AppKind.provider ? ad : null, welcome: true);
    } catch (_) {
    } finally {
      _busy = false;
    }
  }

  Future<void> _claim(BuildContext ctx, Ad ad) async {
    final session = SessionScope.read(context);
    try {
      final r = jMap(await session.api.post('/api/ads/${ad.id}/claim'));
      if (ctx.mounted) Navigator.pop(ctx);
      final gift = jS(r['gift']);
      if (!mounted) return;
      if (r['already'] == true) {
        showSnack(context, 'استلمت هذه الهدية مسبقاً');
      } else if (gift == 'coins') {
        showSnack(context, 'أُضيفت ${r['value']} كوين إلى رصيدك 🎁');
      } else if (gift == 'subscription') {
        showSnack(context, 'تم تفعيل اشتراك مجاني لمدة ${r['value']} يوم 🎁');
      }
      unawaited(session.refresh().catchError((_) {}));
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _show(Ad ad, Ad? gift, {bool welcome = false}) {
    return showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        insetPadding: const EdgeInsets.symmetric(horizontal: 22),
        backgroundColor: Colors.transparent,
        elevation: 0,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          AspectRatio(aspectRatio: adAspect('popup_card'), child: _AdImage(ad: ad, radius: 20)),
          if (welcome) ...[
            const SizedBox(height: 10),
            if (gift != null)
              FilledButton.icon(
                onPressed: () => _claim(ctx, gift),
                style: FilledButton.styleFrom(backgroundColor: Brand.success, minimumSize: const Size(220, 46)),
                icon: const Icon(Icons.card_giftcard_rounded),
                label: Text(gift.giftKind == 'coins' ? 'استلم ${gift.giftValue} كوين هدية' : 'فعّل اشتراكك المجاني (${gift.giftValue} يوم)'),
              )
            else
              FilledButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  unawaited(SessionScope.read(context).api.post('/api/ads/${ad.id}/claim').catchError((_) => null));
                },
                style: FilledButton.styleFrom(minimumSize: const Size(160, 44)),
                child: const Text('شكراً، لنبدأ'),
              ),
          ],
          const SizedBox(height: 12),
          IconButton.filled(
            onPressed: () => Navigator.pop(ctx),
            style: IconButton.styleFrom(backgroundColor: Colors.white, foregroundColor: Brand.foreground),
            icon: const Icon(Icons.close),
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
