import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart' hide Text;

import 'api.dart';
import 'attachments.dart';
import 'config.dart';
import 'format.dart';
import 'i18n.dart';
import 'models.dart';
import 'theme.dart';
import 'widgets.dart';

const _langNames = {'ar': 'العربية', 'en': 'الإنجليزية', 'ur': 'الأردو'};

/// Notice shown at the top of every conversation.
class ChatPrivacyNote extends StatelessWidget {
  const ChatPrivacyNote({super.key, required this.reason});

  /// Why the administration may read the conversation.
  final String reason;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: const Color(0xFFFFF7E0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Icon(Icons.shield_outlined, size: 16, color: Color(0xFF9A6B00)),
        const SizedBox(width: 6),
        Expanded(child: Text(reason, style: const TextStyle(fontSize: 11.5, color: Color(0xFF7A5600), height: 1.45))),
      ]),
    );
  }
}

/// Plays a voice message inside the conversation.
class VoicePlayer extends StatefulWidget {
  const VoicePlayer({super.key, required this.url, this.light = false});
  final String url;
  final bool light;
  @override
  State<VoicePlayer> createState() => _VoicePlayerState();
}

class _VoicePlayerState extends State<VoicePlayer> {
  final _player = AudioPlayer();
  bool _playing = false;
  Duration _pos = Duration.zero;
  Duration _len = Duration.zero;
  final _subs = <StreamSubscription<dynamic>>[];

  @override
  void initState() {
    super.initState();
    _subs.add(_player.onPlayerStateChanged.listen((s) { if (mounted) setState(() => _playing = s == PlayerState.playing); }));
    _subs.add(_player.onPositionChanged.listen((p) { if (mounted) setState(() => _pos = p); }));
    _subs.add(_player.onDurationChanged.listen((d) { if (mounted) setState(() => _len = d); }));
    _subs.add(_player.onPlayerComplete.listen((_) { if (mounted) setState(() { _playing = false; _pos = Duration.zero; }); }));
  }

  @override
  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    _player.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    try {
      if (_playing) {
        await _player.pause();
      } else if (_pos > Duration.zero && _pos < _len) {
        await _player.resume();
      } else {
        await _player.play(UrlSource(absUrl(widget.url)));
      }
    } catch (_) {
      if (mounted) showSnack(context, 'تعذر تشغيل الرسالة الصوتية', error: true);
    }
  }

  String _t(Duration d) => '${d.inMinutes}:${two(d.inSeconds % 60)}';

  @override
  Widget build(BuildContext context) {
    final fg = widget.light ? Colors.white : Theme.of(context).colorScheme.primary;
    final progress = _len.inMilliseconds == 0 ? 0.0 : (_pos.inMilliseconds / _len.inMilliseconds).clamp(0.0, 1.0);
    return SizedBox(
      width: 200,
      child: Row(children: [
        IconButton(
          onPressed: _toggle,
          visualDensity: VisualDensity.compact,
          icon: Icon(_playing ? Icons.pause_circle_filled_rounded : Icons.play_circle_fill_rounded, color: fg, size: 34),
        ),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            LinearProgressIndicator(value: progress, minHeight: 4, color: fg, backgroundColor: fg.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(4)),
            const SizedBox(height: 3),
            Text(_len == Duration.zero ? 'رسالة صوتية' : '${_t(_pos)} / ${_t(_len)}', style: TextStyle(fontSize: 10.5, color: fg.withValues(alpha: 0.85))),
          ]),
        ),
      ]),
    );
  }
}

/// One chat bubble: translated text (with the original on demand), voice player, price events.
class ChatBubble extends StatefulWidget {
  const ChatBubble({super.key, required this.message, required this.mine, this.name});
  final ChatMessage message;
  final bool mine;
  final String? name;
  @override
  State<ChatBubble> createState() => _ChatBubbleState();
}

class _ChatBubbleState extends State<ChatBubble> {
  bool _original = false;

  @override
  Widget build(BuildContext context) {
    final m = widget.message;
    final mine = widget.mine;
    final primary = Theme.of(context).colorScheme.primary;
    if (m.kind.startsWith('price')) {
      final text = switch (m.kind) {
        'price' => 'عرض مبلغ الخدمة: ${m.body} ريال',
        'price_agreed' => 'تمت الموافقة على مبلغ ${m.body} ريال',
        _ => 'المبلغ بالتفاوض بين الطرفين في المحادثة',
      };
      return Center(
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 6),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: m.kind == 'price_agreed' ? Brand.success.withValues(alpha: 0.1) : const Color(0xFFFFF4E0),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: m.kind == 'price_agreed' ? Brand.success.withValues(alpha: 0.4) : const Color(0xFFF2C46B)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(m.kind == 'price_agreed' ? Icons.check_circle_outline : Icons.payments_outlined, size: 18, color: m.kind == 'price_agreed' ? Brand.success : const Color(0xFFB7791F)),
            const SizedBox(width: 6),
            Flexible(child: Text(text, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13))),
          ]),
        ),
      );
    }
    final shown = !_original && m.translated != null ? m.translated! : m.body;
    final fg = mine ? Colors.white : Brand.foreground;
    return Align(
      alignment: mine ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 7),
        decoration: BoxDecoration(
          color: mine ? primary : Colors.white,
          border: mine ? null : Border.all(color: Brand.border),
          borderRadius: BorderRadiusDirectional.only(
            topStart: const Radius.circular(18),
            topEnd: const Radius.circular(18),
            bottomStart: Radius.circular(mine ? 4 : 18),
            bottomEnd: Radius.circular(mine ? 18 : 4),
          ),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (widget.name != null) Text(widget.name!, translate: false, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: mine ? Colors.white : primary)),
          if (m.audioUrl != null) VoicePlayer(url: m.audioUrl!, light: mine),
          if (shown.isNotEmpty) Text(shown, translate: false, style: TextStyle(color: fg, height: 1.45)),
          if (m.translated != null)
            GestureDetector(
              onTap: () => setState(() => _original = !_original),
              child: Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.translate_rounded, size: 13, color: mine ? Colors.white70 : Brand.mutedFg),
                  const SizedBox(width: 3),
                  Text(_original ? 'عرض الترجمة' : 'مترجمة من ${_langNames[m.originalLang] ?? m.originalLang ?? ''} — عرض الأصل',
                      style: TextStyle(fontSize: 10.5, color: mine ? Colors.white70 : Brand.mutedFg, decoration: TextDecoration.underline)),
                ]),
              ),
            ),
          if (m.createdAt != null) Text(fmtTime(m.createdAt!), style: TextStyle(fontSize: 10.5, color: mine ? Colors.white70 : Brand.mutedFg)),
        ]),
      ),
    );
  }
}

/// Message box with a microphone: tap the mic to record, tap again to send the voice message.
class ChatComposer extends StatefulWidget {
  const ChatComposer({super.key, required this.onSend, required this.onVoice});
  final Future<void> Function(String text) onSend;
  final Future<void> Function(UploadFile file) onVoice;
  @override
  State<ChatComposer> createState() => _ChatComposerState();
}

class _ChatComposerState extends State<ChatComposer> {
  final _ctrl = TextEditingController();
  final _rec = VoiceNoteRecorder();
  bool _recording = false;
  bool _busy = false;
  int _secs = 0;
  Timer? _tick;

  @override
  void dispose() {
    _tick?.cancel();
    _ctrl.dispose();
    _rec.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final t = _ctrl.text.trim();
    if (t.isEmpty || _busy) return;
    setState(() => _busy = true);
    _ctrl.clear();
    try {
      await widget.onSend(t);
    } catch (e) {
      _ctrl.text = t;
      if (mounted) showError(context, e);
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _mic() async {
    if (_busy) return;
    if (!_recording) {
      final ok = await _rec.start(maxSeconds: 120, onLimit: _mic);
      if (!ok) {
        if (mounted) showSnack(context, 'اسمح للتطبيق باستخدام الميكروفون لتسجيل رسالة صوتية', error: true);
        return;
      }
      _secs = 0;
      _tick = Timer.periodic(const Duration(seconds: 1), (_) { if (mounted) setState(() => _secs++); });
      setState(() => _recording = true);
      return;
    }
    _tick?.cancel();
    setState(() {
      _recording = false;
      _busy = true;
    });
    try {
      final bytes = await _rec.stop();
      if (bytes == null) {
        if (mounted) showSnack(context, 'التسجيل قصير جداً', error: true);
      } else {
        await widget.onVoice(UploadFile(field: 'audio', filename: 'voice.wav', bytes: bytes, contentType: 'audio/wav'));
      }
    } catch (e) {
      if (mounted) showError(context, e);
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _cancelRecording() async {
    _tick?.cancel();
    await _rec.stop();
    if (mounted) setState(() => _recording = false);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Brand.border))),
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
      child: SafeArea(
        top: false,
        child: Row(children: [
          if (_recording) ...[
            IconButton(onPressed: _cancelRecording, icon: const Icon(Icons.delete_outline, color: Brand.danger)),
            const Icon(Icons.fiber_manual_record, color: Brand.danger, size: 14),
            const SizedBox(width: 6),
            Expanded(child: Text('جارٍ التسجيل… ${_secs ~/ 60}:${two(_secs % 60)} — اضغط للإرسال', style: const TextStyle(fontWeight: FontWeight.w700, color: Brand.danger))),
          ] else
            Expanded(
              child: TextField(
                controller: _ctrl,
                minLines: 1,
                maxLines: 4,
                maxLength: 1000,
                textInputAction: TextInputAction.newline,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(hintText: tr('اكتب رسالتك…'), counterText: '', fillColor: Brand.muted, enabledBorder: InputBorder.none),
              ),
            ),
          const SizedBox(width: 6),
          if (_busy)
            const Padding(padding: EdgeInsets.all(10), child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5)))
          else if (_recording || _ctrl.text.trim().isEmpty)
            IconButton.filled(
              onPressed: _mic,
              style: IconButton.styleFrom(backgroundColor: _recording ? Brand.danger : null),
              icon: Icon(_recording ? Icons.send_rounded : Icons.mic_rounded),
            )
          else
            IconButton.filled(onPressed: _send, icon: Icon(Icons.send_outlined, textDirection: LangState.isRtl ? TextDirection.rtl : TextDirection.ltr)),
        ]),
      ),
    );
  }
}
