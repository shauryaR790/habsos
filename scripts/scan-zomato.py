import re
import pathlib

text = pathlib.Path(r"C:\Users\shaur\AppData\Local\Temp\zomato-order.html").read_text(encoding="utf-8", errors="ignore")
print("len", len(text))
title = re.search(r"<title>(.*?)</title>", text, re.I | re.S)
print("title", (title.group(1)[:180] if title else "none"))
urls = sorted(set(re.findall(r"https://[^\"'\\ ]+\.(?:jpg|jpeg|webp|png)", text, re.I)))
print("img urls", len(urls))
for url in urls[:40]:
    print(url[:220])
print("zmtcdn", text.lower().count("zmtcdn"))
print("cappuccino", text.lower().count("cappuccino"))
# also escaped urls
esc = sorted(set(re.findall(r"https:\\/\\/[^\"'\\ ]+?\.(?:jpg|jpeg|webp|png)", text, re.I)))
print("escaped", len(esc))
for url in esc[:20]:
    print(url[:220])
