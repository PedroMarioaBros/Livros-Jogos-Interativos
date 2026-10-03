#!/usr/bin/env python3
from __future__ import annotations

import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = "io.github.pedromariabros.livrosjogos"
APK = Path("android/app/build/outputs/apk/debug/app-debug.apk")
OUT = APK.parent
REMOTE_XML = "/sdcard/livros-jogos-window.xml"


def run(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    print("+", " ".join(args), flush=True)
    result = subprocess.run(
        args,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if result.stdout:
        print(result.stdout.rstrip(), flush=True)
    if check and result.returncode != 0:
        raise RuntimeError(
            f"Comando falhou ({result.returncode}): {' '.join(args)}"
        )
    return result


def adb(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(["adb", *args], check=check)


def dump_ui(name: str = "window") -> ET.Element:
    adb("shell", "uiautomator", "dump", REMOTE_XML)
    xml = adb("exec-out", "cat", REMOTE_XML).stdout
    path = OUT / f"emulator-{name}.xml"
    path.write_text(xml, encoding="utf-8")
    return ET.fromstring(xml)


def node_label(node: ET.Element) -> str:
    attrs = node.attrib
    return " ".join(
        part for part in (
            attrs.get("text", ""),
            attrs.get("content-desc", ""),
            attrs.get("resource-id", ""),
        )
        if part
    ).strip()


def visible_labels(root: ET.Element) -> list[str]:
    values: list[str] = []
    for node in root.iter("node"):
        value = node_label(node)
        if value and value not in values:
            values.append(value)
    return values


def find_node(root: ET.Element, needle: str) -> ET.Element | None:
    wanted = needle.casefold()
    exact: ET.Element | None = None
    contains: ET.Element | None = None

    for node in root.iter("node"):
        label = node_label(node)
        folded = label.casefold()
        if folded == wanted:
            exact = node
            break
        if wanted in folded and contains is None:
            contains = node

    return exact if exact is not None else contains


def node_center(node: ET.Element) -> tuple[int, int]:
    bounds = node.attrib.get("bounds", "")
    numbers = [int(value) for value in re.findall(r"\d+", bounds)]
    if len(numbers) != 4:
        raise RuntimeError(f"Bounds inválidos: {bounds!r}")
    x1, y1, x2, y2 = numbers
    return (x1 + x2) // 2, (y1 + y2) // 2


def swipe_up() -> None:
    adb("shell", "input", "swipe", "540", "1950", "540", "650", "350")
    time.sleep(0.7)


def swipe_down() -> None:
    adb("shell", "input", "swipe", "540", "650", "540", "1950", "350")
    time.sleep(0.7)


def node_is_visible(node: ET.Element) -> bool:
    bounds = node.attrib.get("bounds", "")
    numbers = [int(value) for value in re.findall(r"\d+", bounds)]
    if len(numbers) != 4:
        return False
    x1, y1, x2, y2 = numbers
    return x2 > x1 and y2 > y1 and x2 > 0 and y2 > 0


def find_with_scroll(needle: str, *, attempts: int = 7) -> ET.Element:
    for attempt in range(attempts):
        root = dump_ui(f"search-{attempt}")
        node = find_node(root, needle)
        if node is not None and node_is_visible(node):
            return node
        swipe_up()

    root = dump_ui("not-found")
    labels = "\n".join(f"  - {value}" for value in visible_labels(root))
    raise RuntimeError(
        f"Elemento não encontrado: {needle!r}. Textos visíveis:\n{labels}"
    )


def tap_text(needle: str) -> None:
    node = find_with_scroll(needle)
    x, y = node_center(node)
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(1.0)


def wait_for_text(needle: str, *, timeout: float = 20.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        root = dump_ui("wait")
        if find_node(root, needle) is not None:
            return
        time.sleep(1.0)
    raise RuntimeError(f"Texto não apareceu a tempo: {needle!r}")


def screenshot(name: str) -> None:
    path = OUT / f"emulator-{name}.png"
    result = subprocess.run(
        ["adb", "exec-out", "screencap", "-p"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0 or not result.stdout:
        raise RuntimeError(
            f"Falha ao capturar tela {name}: "
            + result.stderr.decode("utf-8", errors="replace")
        )
    path.write_bytes(result.stdout)
    if path.stat().st_size == 0:
        raise RuntimeError(f"Captura vazia: {path}")


def dismiss_system_dialogs() -> None:
    for _ in range(4):
        root = dump_ui("system-dialog-check")
        wait_node = find_node(root, "Wait")
        if wait_node is not None and wait_node.attrib.get("package") == "android":
            x, y = node_center(wait_node)
            adb("shell", "input", "tap", str(x), str(y))
            time.sleep(1.0)
            continue

        close_node = find_node(root, "Close app")
        if close_node is not None and close_node.attrib.get("package") == "android":
            adb("shell", "input", "keyevent", "4")
            time.sleep(1.0)
            continue
        return


def launch_app() -> None:
    adb("shell", "am", "force-stop", PACKAGE)
    adb(
        "shell",
        "am",
        "start",
        "-W",
        "-n",
        f"{PACKAGE}/.MainActivity",
    )
    time.sleep(4)
    dismiss_system_dialogs()
    pid = adb("shell", "pidof", PACKAGE).stdout.strip()
    if not pid:
        raise RuntimeError("O processo do aplicativo não permaneceu ativo.")


def assert_foreground() -> None:
    output = adb("shell", "dumpsys", "activity", "activities").stdout
    foreground_lines = [
        line
        for line in output.splitlines()
        if "mResumedActivity" in line or "topResumedActivity" in line
    ]
    if not any(PACKAGE in line for line in foreground_lines):
        raise RuntimeError(
            "A Activity do aplicativo não está em primeiro plano. "
            + " | ".join(foreground_lines[-5:])
        )


def enable_airplane_mode() -> None:
    result = adb(
        "shell", "cmd", "connectivity", "airplane-mode", "enable",
        check=False,
    )
    if result.returncode != 0:
        adb("shell", "settings", "put", "global", "airplane_mode_on", "1")
        adb(
            "shell",
            "am",
            "broadcast",
            "-a",
            "android.intent.action.AIRPLANE_MODE",
            "--ez",
            "state",
            "true",
        )
    adb("shell", "svc", "wifi", "disable", check=False)
    adb("shell", "svc", "data", "disable", check=False)
    value = adb(
        "shell", "settings", "get", "global", "airplane_mode_on"
    ).stdout.strip()
    if value != "1":
        raise RuntimeError(f"Modo avião não foi ativado: {value!r}")


def disable_airplane_mode() -> None:
    result = adb(
        "shell", "cmd", "connectivity", "airplane-mode", "disable",
        check=False,
    )
    if result.returncode != 0:
        adb(
            "shell", "settings", "put", "global", "airplane_mode_on", "0",
            check=False,
        )
        adb(
            "shell",
            "am",
            "broadcast",
            "-a",
            "android.intent.action.AIRPLANE_MODE",
            "--ez",
            "state",
            "false",
            check=False,
        )
    adb("shell", "svc", "wifi", "enable", check=False)


def main() -> None:
    if not APK.is_file():
        raise RuntimeError(f"APK ausente: {APK}")

    OUT.mkdir(parents=True, exist_ok=True)
    adb("install", "-r", str(APK))
    adb("shell", "pm", "path", PACKAGE)

    try:
        launch_app()
        assert_foreground()
        wait_for_text("Nova partida")
        screenshot("launch")

        tap_text("Solo")
        tap_text("Colthar")
        tap_text("Gerar ficha e começar")
        wait_for_text("Referência 1")

        tap_text("Salvar partida")
        wait_for_text("Partida salva na referência 1")
        screenshot("saved")

        adb("shell", "am", "force-stop", PACKAGE)
        enable_airplane_mode()

        launch_app()
        assert_foreground()
        wait_for_text("Nova partida")
        screenshot("offline-relaunch")

        tap_text("Carregar partida salva")
        wait_for_text("Partida carregada")
        node = find_with_scroll("Referência 1")
        if node is None:
            raise RuntimeError("A referência salva não foi restaurada.")

        assert_foreground()
        screenshot("offline-save-load")
        dump_ui("offline-save-load")

        print(
            "OK: APK instalou, abriu, persistiu save após force-stop, "
            "reabriu em modo avião e restaurou a partida na referência 1.",
            flush=True,
        )
    finally:
        disable_airplane_mode()


if __name__ == "__main__":
    main()
