import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import 'config.dart';

/// Error returned by the Worker (`{ error, message }`) or a network failure (status 0).
class ApiException implements Exception {
  ApiException(this.status, this.code, this.message, [this.body = const {}]);
  final int status;
  final String code;
  final String message;
  final Map<String, dynamic> body;

  @override
  String toString() => message;
}

/// A file attached to a multipart request (provider documents).
class UploadFile {
  const UploadFile({required this.field, required this.filename, required this.bytes, required this.contentType});
  final String field;
  final String filename;
  final Uint8List bytes;
  final String contentType;
}

/// Thin JSON client for the Mohemah Worker with bearer-token sessions.
class Api {
  Api({String? base}) : base = base ?? apiBase;

  final String base;
  String? token;
  final http.Client _client = http.Client();

  /// Called when the server reports the session is no longer valid.
  void Function()? onUnauthorized;

  Map<String, String> get _headers => {
        'accept': 'application/json',
        if (token != null) 'authorization': 'Bearer $token',
      };

  Uri uri(String path) => Uri.parse(path.startsWith('http') ? path : '$base$path');

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body ?? const <String, dynamic>{});
  Future<dynamic> patch(String path, Object body) => _send('PATCH', path, body);
  Future<dynamic> put(String path, Object body) => _send('PUT', path, body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final req = http.Request(method, uri(path));
    req.headers.addAll(_headers);
    if (body != null) {
      req.headers['content-type'] = 'application/json';
      req.body = jsonEncode(body);
    }
    return _run(() => _client.send(req));
  }

  Future<dynamic> multipart(String path, Map<String, String> fields, List<UploadFile> files) async {
    final req = http.MultipartRequest('POST', uri(path));
    req.headers.addAll(_headers);
    req.fields.addAll(fields);
    for (final f in files) {
      req.files.add(http.MultipartFile.fromBytes(f.field, f.bytes, filename: f.filename, contentType: MediaType.parse(f.contentType)));
    }
    return _run(() => _client.send(req), timeout: const Duration(seconds: 90));
  }

  Future<dynamic> _run(Future<http.StreamedResponse> Function() send, {Duration timeout = const Duration(seconds: 30)}) async {
    late http.StreamedResponse res;
    late String text;
    try {
      res = await send().timeout(timeout);
      text = await res.stream.bytesToString();
    } on TimeoutException {
      throw ApiException(0, 'timeout', 'انتهت مهلة الاتصال، حاول مجدداً');
    } catch (_) {
      throw ApiException(0, 'network', 'تعذّر الاتصال بالخادم، تحقق من الإنترنت');
    }
    dynamic data;
    try {
      data = text.isEmpty ? null : jsonDecode(text);
    } catch (_) {
      data = null;
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return data;
    final map = data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
    final code = (map['error'] ?? 'http_${res.statusCode}').toString();
    if (res.statusCode == 401 && token != null) onUnauthorized?.call();
    throw ApiException(res.statusCode, code, (map['message'] ?? _fallback(res.statusCode, code)).toString(), map);
  }

  static String _fallback(int status, String code) {
    if (code == 'insufficient_balance') return 'رصيد الكوينز غير كافٍ';
    if (code == 'subscription_required') return 'تحتاج اشتراكاً فعّالاً لقبول الطلبات';
    if (status == 401) return 'سجّل الدخول للمتابعة';
    if (status == 403) return 'لا تملك صلاحية لهذه العملية';
    if (status == 404) return 'غير موجود';
    if (status == 429) return 'محاولات كثيرة، حاول بعد قليل';
    return 'حدث خطأ غير متوقع، حاول مجدداً';
  }
}

String errMsg(Object e) => e is ApiException ? e.message : 'حدث خطأ غير متوقع، حاول مجدداً';
