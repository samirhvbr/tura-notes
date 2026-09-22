# `fixtures/pdf/`

PDFs that exist to be **refused**, not to be read.

`standard-encoding.pdf` is a structurally valid, 608-byte PDF whose only font
declares `/Encoding /StandardEncoding`. `pdf-extract 0.12.0` reaches
`encoding_to_unicode_table`, whose match arms are exactly `MacRomanEncoding`,
`MacExpertEncoding` and `WinAnsiEncoding`, and calls `panic!` on everything
else. It is the cheapest reproduction of the class: that one file also holds 31
`panic!`, a `todo!` and 42 `unwrap()`, and a predefined non-Identity CMap — most
CJK documents — panics the same way a few hundred lines further down.

The point of keeping it is that `pdf_extract` must answer `Unsupported`
(ADR-068) rather than take the process with it. It was generated, not captured
from anyone's disk, and carries no content.
