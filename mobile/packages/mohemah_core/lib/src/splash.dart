import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

import 'theme.dart';

/// Opening animation: slanted slides sweep in from both sides and overlap,
/// a final brand slide covers the screen, then the logo and the app name appear.
///
/// [onFinished] runs once the animation has played AND [waitFor] has completed
/// (session restore / data load), so the app never opens half-ready.
class SlidesSplash extends StatefulWidget {
  const SlidesSplash({
    super.key,
    required this.title,
    required this.subtitle,
    required this.onFinished,
    this.waitFor,
    this.palette = SplashPalette.customer,
  });

  final String title;
  final String subtitle;
  final VoidCallback onFinished;
  final Future<void>? waitFor;
  final SplashPalette palette;

  @override
  State<SlidesSplash> createState() => _SlidesSplashState();
}

class SplashPalette {
  const SplashPalette(this.slides, this.cover);
  final List<Color> slides;
  final List<Color> cover;

  static const customer = SplashPalette(
    [Color(0xFF2B54AE), Color(0xE63D70D1), Color(0xD9359BD9), Color(0xE68FDCC0)],
    [Color(0xFF3A6CCE), Color(0xFF359BD9), Color(0xFF8FDCC0)],
  );
  static const provider = SplashPalette(
    [Color(0xFF1B2F6B), Color(0xE62B54AE), Color(0xD9138A8F), Color(0xE6A5E9CA)],
    [Color(0xFF1B2F6B), Color(0xFF2B54AE), Color(0xFF138A8F)],
  );
}

class _SlidesSplashState extends State<SlidesSplash> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 3000));
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _run();
  }

  Future<void> _run() async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
    if (!mounted) return;
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reduce) {
      _c.value = 1;
    } else {
      await _c.forward();
    }
    try {
      await widget.waitFor;
    } catch (_) {}
    await Future<void>.delayed(const Duration(milliseconds: 350));
    if (mounted && !_done) {
      _done = true;
      widget.onFinished();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  static double _phase(double t, double a, double b, [Curve curve = Curves.linear]) {
    if (t <= a) return 0;
    if (t >= b) return 1;
    return curve.transform((t - a) / (b - a));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Brand.background,
      body: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = _c.value;
          final logoIn = _phase(t, 0.66, 0.86, Curves.easeOutBack);
          final logoFade = _phase(t, 0.66, 0.78);
          final textIn = _phase(t, 0.78, 0.96, Curves.easeOutCubic);
          return Stack(
            fit: StackFit.expand,
            children: [
              CustomPaint(painter: _SlidesPainter(t, widget.palette)),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Opacity(
                      opacity: logoFade,
                      child: Transform.rotate(
                        angle: (1 - logoIn) * -0.35,
                        child: Transform.scale(
                          scale: 0.4 + 0.6 * logoIn,
                          child: Container(
                            width: 132,
                            height: 132,
                            padding: const EdgeInsets.all(22),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(38),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.35), width: 1.2),
                              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 30, offset: const Offset(0, 14))],
                            ),
                            child: Image.asset('assets/logo.png', package: 'mohemah_core', fit: BoxFit.contain),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 26),
                    Opacity(
                      opacity: textIn,
                      child: Transform.translate(
                        offset: Offset(0, 18 * (1 - textIn)),
                        child: Column(
                          children: [
                            Text(widget.title,
                                style: const TextStyle(fontFamily: kFont, fontSize: 34, fontWeight: FontWeight.w800, color: Colors.white, height: 1.1)),
                            const SizedBox(height: 6),
                            Text(widget.subtitle,
                                style: TextStyle(fontFamily: kFont, fontSize: 15, fontWeight: FontWeight.w500, color: Colors.white.withValues(alpha: 0.88))),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 42,
                child: Opacity(
                  opacity: textIn,
                  child: const Center(child: SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SlidesPainter extends CustomPainter {
  _SlidesPainter(this.t, this.palette);
  final double t;
  final SplashPalette palette;

  // Where each slide comes to rest (fraction of width from the center) and when it starts.
  static const _rest = [-0.30, 0.22, -0.06, 0.34];
  static const _start = [0.00, 0.09, 0.18, 0.27];

  Path _slide(Size s, double cx, double width) {
    final skew = s.height * 0.34;
    final half = width / 2;
    return Path()
      ..moveTo(cx - half + skew / 2, -2)
      ..lineTo(cx + half + skew / 2, -2)
      ..lineTo(cx + half - skew / 2, s.height + 2)
      ..lineTo(cx - half - skew / 2, s.height + 2)
      ..close();
  }

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final full = Offset.zero & size;

    // 1) Overlapping slides sweep in, alternating sides.
    for (var i = 0; i < palette.slides.length; i++) {
      final p = _SlidesSplashState._phase(t, _start[i], _start[i] + 0.30, Curves.easeOutCubic);
      if (p <= 0) continue;
      final fromRight = i.isEven;
      final from = fromRight ? w * 1.9 : -w * 0.9;
      // A gentle drift after landing keeps the stack alive until the cover arrives.
      final drift = math.sin(t * math.pi * 2 + i) * w * 0.012;
      final cx = lerpDouble(from, w * (0.5 + _rest[i]), p)! + drift;
      final path = _slide(size, cx, w * 0.46);
      canvas.drawShadow(path, Colors.black, 14, false);
      canvas.drawPath(path, Paint()..color = palette.slides[i]);
      // Light edge to make the overlap read clearly.
      canvas.drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2
          ..color = Colors.white.withValues(alpha: 0.22),
      );
    }

    // 2) The brand slide sweeps over everything.
    final c = _SlidesSplashState._phase(t, 0.48, 0.70, Curves.easeInOutCubic);
    if (c > 0) {
      final cx = lerpDouble(w * 2.4, w * 0.5, c)!;
      final path = _slide(size, cx, w * 2.8);
      canvas.drawShadow(path, Colors.black, 18, false);
      canvas.drawPath(
        path,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: palette.cover,
          ).createShader(full),
      );
    }

    // 3) A soft light sweep across the cover as the logo lands.
    final shine = _SlidesSplashState._phase(t, 0.70, 0.98, Curves.easeInOut);
    if (shine > 0 && shine < 1) {
      final cx = lerpDouble(-w * 0.6, w * 1.6, shine)!;
      canvas.drawPath(_slide(size, cx, w * 0.22), Paint()..color = Colors.white.withValues(alpha: 0.08 * math.sin(shine * math.pi)));
    }
  }

  @override
  bool shouldRepaint(_SlidesPainter old) => old.t != t || old.palette != palette;
}
