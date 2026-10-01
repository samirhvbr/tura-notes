use base64::Engine;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let config: serde_json::Value = serde_json::from_slice(&std::fs::read(&args[3])?)?;
    let decode = |s: &str| -> Result<String, Box<dyn std::error::Error>> {
        Ok(String::from_utf8(
            base64::engine::general_purpose::STANDARD.decode(s.trim())?,
        )?)
    };
    let key = decode(
        config["plugins"]["updater"]["pubkey"]
            .as_str()
            .ok_or("missing public key")?,
    )?;
    let signature = decode(&std::fs::read_to_string(&args[2])?)?;
    let signature = minisign_verify::Signature::decode(&signature)?;
    minisign_verify::PublicKey::decode(&key)?.verify(&std::fs::read(&args[1])?, &signature, false)?;
    // The version the signature was made for, when the caller says which it must
    // be. The trusted comment is covered by the signature, so this is what an
    // app that requires a signed version (`requireSignedVersion`) will read.
    if let Some(want) = args.get(4) {
        let signed = signature
            .trusted_comment()
            .split('\t')
            .find_map(|field| field.strip_prefix("version:"));
        if signed != Some(want.as_str()) {
            return Err(format!("the signature was made for {signed:?}, not for {want}").into());
        }
    }
    Ok(())
}
