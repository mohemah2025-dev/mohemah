// Typed views over the Worker's JSON. Parsing is lenient: D1 returns numbers
// for booleans (0/1) and may return null for optional columns.

String? jStr(dynamic v) => v == null ? null : v.toString();
String jS(dynamic v, [String def = '']) => v == null ? def : v.toString();
int jInt(dynamic v, [int def = 0]) => v is int ? v : (v is num ? v.toInt() : (int.tryParse('${v ?? ''}') ?? def));
double jDouble(dynamic v, [double def = 0]) => v is num ? v.toDouble() : (double.tryParse('${v ?? ''}') ?? def);
double? jDoubleOrNull(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
bool jBool(dynamic v) => v == true || v == 1 || v == '1' || v == 'true';
Map<String, dynamic> jMap(dynamic v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
List<Map<String, dynamic>> jList(dynamic v) => v is List ? v.map<Map<String, dynamic>>((e) => jMap(e)).toList() : <Map<String, dynamic>>[];
List<String> jStrings(dynamic v) => v is List ? v.map((e) => '$e').toList() : <String>[];
DateTime? jDate(dynamic v) => v == null ? null : DateTime.tryParse(v.toString())?.toLocal();

class Profile {
  Profile(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  String? get email => jStr(raw['email']);
  String? get username => jStr(raw['username']);
  String? get phone => jStr(raw['phone']);
  String get fullName => jS(raw['full_name'], 'مستخدم');
  String get firstName => fullName.trim().split(RegExp(r'\s+')).first;
  String? get region => jStr(raw['region']);
  String? get gender => jStr(raw['gender']);
  String? get bio => jStr(raw['bio']);
  int get coinBalance => jInt(raw['coin_balance']);
  double get rating => jDouble(raw['rating']);
  int get ratingCount => jInt(raw['rating_count']);
  bool get isOnline => jBool(raw['is_online']);
  String get billingMode => jS(raw['billing_mode'], 'coins');
  String? get nationalId => jStr(raw['national_id']);
  String? get nationality => jStr(raw['nationality']);

  /// none | pending | approved | rejected
  String get verificationStatus => jS(raw['verification_status'], 'none');
  String? get reviewNote => jStr(raw['review_note']);
  List<String> get requestedServices => jStrings(raw['requested_services']);
  String? get referralCode => jStr(raw['referral_code']);
  DateTime? get createdAt => jDate(raw['created_at']);
}

class AppSettings {
  AppSettings(this.raw);
  final Map<String, dynamic> raw;
  String get appName => jS(raw['app_name'], 'مهمة');
  String? get logoUrl => jStr(raw['logo_url']);
  String get currency => jS(raw['currency_label'], 'ريال');
  String? get supportEmail => jStr(raw['support_email']);
  String? get supportPhone => jStr(raw['support_phone']);
  String? get welcomeCustomer => jStr(raw['welcome_customer']);
  String? get welcomeProvider => jStr(raw['welcome_provider']);
  bool get coinsEnabled => jBool(raw['billing_coins_enabled']);
  bool get subscriptionEnabled => jBool(raw['billing_subscription_enabled']);
}

class Service {
  Service(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  String get name => jS(raw['name']);
  String? get description => jStr(raw['description']);
  String? get icon => jStr(raw['icon']);
  String? get color => jStr(raw['color']);
  int get coinPrice => jInt(raw['coin_price']);
}

class SubService {
  SubService(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  String get serviceId => jS(raw['service_id']);
  String get name => jS(raw['name']);
  String? get description => jStr(raw['description']);
  String? get icon => jStr(raw['icon']);
  String? get color => jStr(raw['color']);
  int get coinPrice => jInt(raw['coin_price']);

  /// in_person | remote | both
  String get deliveryMode => jS(raw['delivery_mode'], 'both');
}

class Ad {
  Ad(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  String get title => jS(raw['title']);
  String? get sponsor => jStr(raw['sponsor']);
  String? get imageUrl => jStr(raw['image_url']);
  String? get link => jStr(raw['link']);
  String? get placement => jStr(raw['placement']);
}

class Policy {
  Policy(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  String get title => jS(raw['title']);
  String get body => jS(raw['body']);
  String get audience => jS(raw['audience'], 'all');
  String? get type => jStr(raw['policy_type']);
  DateTime? get updatedAt => jDate(raw['updated_at']);
}

class Address {
  Address(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  String get label => jS(raw['label']);
  String get address => jS(raw['address']);
  String? get region => jStr(raw['region']);
  double? get lat => jDoubleOrNull(raw['lat']);
  double? get lng => jDoubleOrNull(raw['lng']);
  bool get isDefault => jBool(raw['is_default']);
}

class AppNotification {
  AppNotification(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  String get title => jS(raw['title']);
  String get body => jS(raw['body']);
  String? get icon => jStr(raw['icon']);
  String? get link => jStr(raw['link']);
  DateTime? get at => jDate(raw['at']);
  bool get read => jBool(raw['read']);
}

class ChatMessage {
  ChatMessage(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  String get senderId => jS(raw['sender_id']);
  String? get recipientId => jStr(raw['recipient_id']);
  String? get senderName => jStr(raw['sender_name']);
  String? get subject => jStr(raw['subject']);
  String get body => jS(raw['body']);
  DateTime? get createdAt => jDate(raw['created_at']);
  DateTime? get readAt => jDate(raw['read_at']);
}

/// Order as seen by the customer (`GET /api/orders/mine`).
class CustomerOrder {
  CustomerOrder(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  int get orderNo => jInt(raw['order_no']);
  String get serviceName => jS(raw['service_name']);
  String? get subServiceName => jStr(raw['sub_service_name']);
  String get title => subServiceName ?? serviceName;
  String? get serviceId => jStr(raw['service_id']);
  String get mode => jS(raw['mode'], 'in_person');
  String? get description => jStr(raw['description']);
  String? get address => jStr(raw['address']);
  String? get region => jStr(raw['region']);
  DateTime? get scheduledAt => jDate(raw['scheduled_at']);
  String get status => jS(raw['status'], 'pending');
  int? get rating => raw['rating'] == null ? null : jInt(raw['rating']);
  String? get review => jStr(raw['review']);
  String? get cancelledBy => jStr(raw['cancelled_by']);
  String? get cancelReason => jStr(raw['cancel_reason']);
  DateTime? get createdAt => jDate(raw['created_at']);
  DateTime? get acceptedAt => jDate(raw['accepted_at']);
  DateTime? get arrivedAt => jDate(raw['arrived_at']);
  DateTime? get startedAt => jDate(raw['started_at']);
  DateTime? get completedAt => jDate(raw['completed_at']);
  DateTime? get cancelledAt => jDate(raw['cancelled_at']);
  int get unread => jInt(raw['unread']);
  Map<String, dynamic>? get provider => raw['provider'] is Map ? jMap(raw['provider']) : null;
  String? get providerName => jStr(provider?['name']);
  String? get providerPhone => jStr(provider?['phone']);
  double get providerRating => jDouble(provider?['rating']);
  int get providerRatingCount => jInt(provider?['rating_count']);
  bool get isActive => const ['accepted', 'arrived', 'in_progress'].contains(status);
  bool get isOpen => status == 'pending' || isActive;
}

/// Order offered to a provider (`available` in the feed).
class OfferedOrder {
  OfferedOrder(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  int get orderNo => jInt(raw['order_no']);
  String get serviceName => jS(raw['service_name']);
  String? get subServiceName => jStr(raw['sub_service_name']);
  String get title => subServiceName ?? serviceName;
  String get mode => jS(raw['mode'], 'in_person');
  String? get description => jStr(raw['description']);
  String? get region => jStr(raw['region']);
  DateTime? get scheduledAt => jDate(raw['scheduled_at']);
  int get coinCost => jInt(raw['coin_cost']);
  DateTime? get createdAt => jDate(raw['created_at']);
  String get customerName => jS(jMap(raw['customer'])['name'], 'عميل');
  double get customerRating => jDouble(jMap(raw['customer'])['rating']);
  int get customerRatingCount => jInt(jMap(raw['customer'])['rating_count']);
}

/// Job the provider has accepted (`active` in the feed).
class ActiveJob {
  ActiveJob(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  int get orderNo => jInt(raw['order_no']);
  String get serviceName => jS(raw['service_name']);
  String? get subServiceName => jStr(raw['sub_service_name']);
  String get title => subServiceName ?? serviceName;
  String get mode => jS(raw['mode'], 'in_person');
  String? get description => jStr(raw['description']);
  String? get region => jStr(raw['region']);
  String? get address => jStr(raw['address']);
  double? get lat => jDoubleOrNull(raw['lat']);
  double? get lng => jDoubleOrNull(raw['lng']);
  DateTime? get scheduledAt => jDate(raw['scheduled_at']);
  String get status => jS(raw['status'], 'accepted');
  int get chargedCoins => jInt(raw['charged_coins']);
  String? get billingMode => jStr(raw['billing_mode']);
  DateTime? get acceptedAt => jDate(raw['accepted_at']);
  int get unread => jInt(raw['unread']);
  String get customerName => jS(jMap(raw['customer'])['name'], 'عميل');
  String? get customerPhone => jStr(jMap(raw['customer'])['phone']);
  double get customerRating => jDouble(jMap(raw['customer'])['rating']);
}

class ProviderFeed {
  ProviderFeed(this.raw);
  final Map<String, dynamic> raw;
  bool get online => jBool(raw['online']);
  String? get region => jStr(raw['region']);
  int get servicesCount => jInt(raw['services_count']);
  int get balance => jInt(raw['balance']);
  String get billingMode => jS(raw['billing_mode'], 'coins');
  DateTime? get subscriptionEnd => jDate(raw['subscription_end']);
  List<OfferedOrder> get available => jList(raw['available']).map(OfferedOrder.new).toList();
  List<ActiveJob> get active => jList(raw['active']).map(ActiveJob.new).toList();
}

class HistoryOrder {
  HistoryOrder(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  int get orderNo => jInt(raw['order_no']);
  String get title => jStr(raw['sub_service_name']) ?? jS(raw['service_name']);
  String get mode => jS(raw['mode'], 'in_person');
  String get status => jS(raw['status']);
  String? get description => jStr(raw['description']);
  String? get region => jStr(raw['region']);
  int? get rating => raw['rating'] == null ? null : jInt(raw['rating']);
  String? get review => jStr(raw['review']);
  int? get customerRating => raw['customer_rating'] == null ? null : jInt(raw['customer_rating']);
  int get chargedCoins => jInt(raw['charged_coins']);
  DateTime? get completedAt => jDate(raw['completed_at']);
  DateTime? get cancelledAt => jDate(raw['cancelled_at']);
  DateTime? get createdAt => jDate(raw['created_at']);
  String get customerName => jS(jMap(raw['customer'])['name'], 'عميل');
}

class Gateway {
  Gateway(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  String get name => jS(raw['name']);
  bool get testMode => jBool(raw['test_mode']);
}

class Billing {
  Billing(this.raw);
  final Map<String, dynamic> raw;
  bool get coinsEnabled => jBool(raw['billing_coins_enabled']);
  bool get subscriptionEnabled => jBool(raw['billing_subscription_enabled']);
  bool get testPayments => jBool(raw['test_payments_enabled']);
  int get balance => jInt(raw['balance']);
  String get mode => jS(raw['billing_mode'], 'coins');
  double get vat => jDouble(raw['vat_percent']);
  DateTime? get subscriptionEnd => jDate(raw['subscription_end']);
  List<Gateway> get gateways => jList(raw['gateways']).map(Gateway.new).toList();
  Map<int, double> get plans => {
        1: jDouble(raw['sub_price_1m']),
        3: jDouble(raw['sub_price_3m']),
        6: jDouble(raw['sub_price_6m']),
        12: jDouble(raw['sub_price_12m']),
      };
}

class CoinTx {
  CoinTx(this.raw);
  final Map<String, dynamic> raw;
  String get id => jS(raw['id']);
  int get amount => jInt(raw['amount']);

  /// topup | deduction | refund | grant ...
  String get type => jS(raw['tx_type']);
  int get balanceAfter => jInt(raw['balance_after']);
  String get description => jS(raw['description']);
  String? get method => jStr(raw['method']);
  DateTime? get createdAt => jDate(raw['created_at']);
  bool get isDebit => type == 'deduction';
}

class ProviderStats {
  ProviderStats(this.raw);
  final Map<String, dynamic> raw;
  int get completed => jInt(raw['completed']);
  int get cancelled => jInt(raw['cancelled']);
  int get active => jInt(raw['active']);
  double get rating => jDouble(raw['rating']);
  int get ratingCount => jInt(raw['rating_count']);
  double get workHours => jDouble(raw['work_hours']);
  DateTime? get joinedAt => jDate(raw['joined_at']);
  List<Map<String, dynamic>> get servicesBreakdown => jList(raw['services_breakdown']);

  /// Completed orders per day (Riyadh time), keyed `yyyy-MM-dd`.
  Map<String, int> get weekly => {for (final r in jList(raw['weekly'])) jS(r['day']): jInt(r['count'])};

  /// Orders created per hour of day (0–23) for the provider's services in the last 30 days.
  Map<int, int> get demandByHour => {for (final r in jList(raw['demand_by_hour'])) jInt(r['hour']): jInt(r['count'])};
  List<Map<String, dynamic>> get recent => jList(raw['recent']);
}
