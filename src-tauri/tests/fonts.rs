use notchpad::fonts::normalize_font_names;

#[test]
fn normalizes_trims_dedups_and_filters() {
  let raw = vec![
    " Arial ".to_string(),
    "Arial".to_string(),
    "".to_string(),
    "   ".to_string(),
    "@宋体".to_string(), // 垂直字体,应过滤
    "Microsoft YaHei".to_string(),
  ];
  assert_eq!(
    normalize_font_names(raw),
    vec!["Arial".to_string(), "Microsoft YaHei".to_string()]
  );
}

#[test]
fn sorts_by_name() {
  let raw = vec!["SimSun".to_string(), "Arial".to_string(), "KaiTi".to_string()];
  assert_eq!(
    normalize_font_names(raw),
    vec!["Arial".to_string(), "KaiTi".to_string(), "SimSun".to_string()]
  );
}
