use std::time::Instant;
use notify::{RecursiveMode, Watcher as _};

#[test]
fn probe() {
    // Build the same corpus shape the deep test uses.
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path();
    for i in 0..400 {
        let d = root.join(format!("d{i}"));
        std::fs::create_dir_all(d.join("a").join("b")).unwrap();
        std::fs::write(d.join("n.md"), b"# x").unwrap();
    }
    let t = Instant::now();
    let mut w = notify::recommended_watcher(|_res| {}).unwrap();
    let created = t.elapsed();

    let t2 = Instant::now();
    w.watch(root, RecursiveMode::Recursive).unwrap();
    let watched = t2.elapsed();

    let t3 = Instant::now();
    let c = root.canonicalize().unwrap();
    let canon = t3.elapsed();

    // A second watcher on an already-canonical path.
    let t4 = Instant::now();
    let mut w2 = notify::recommended_watcher(|_res| {}).unwrap();
    w2.watch(&c, RecursiveMode::Recursive).unwrap();
    let second = t4.elapsed();

    println!("recommended_watcher: {:?}", created);
    println!("watch(Recursive):    {:?}", watched);
    println!("canonicalize:        {:?}", canon);
    println!("second watcher+watch:{:?}", second);
}
