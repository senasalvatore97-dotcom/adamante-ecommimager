import SwiftUI
import AppKit
import UniformTypeIdentifiers
import ApplicationServices
import CoreGraphics

// Adamante Photo Studio — utility locale per preparare una conversazione ChatGPT.
// Nessun accesso alle API OpenAI e nessuna credenziale memorizzata nell'app.

enum Shot: String, CaseIterable, Identifiable {
    case main = "main"
    case front = "front"
    case worn = "worn"
    case packaging = "packaging"

    var id: String { rawValue }

    var number: String {
        switch self {
        case .main: return "01"
        case .front: return "02"
        case .worn: return "03"
        case .packaging: return "04"
        }
    }

    var name: String {
        switch self {
        case .main: return "Foto principale"
        case .front: return "Seconda prospettiva"
        case .worn: return "Gioiello indossato"
        case .packaging: return "Confezione"
        }
    }

    var hint: String {
        switch self {
        case .main: return "Terza reference: anello a tre quarti, fondo bianco."
        case .front: return "Quarta reference: anello frontale, simmetrico."
        case .worn: return "Seconda reference: anello indossato su mano."
        case .packaging: return "Prima reference: scrigno bordeaux e avorio."
        }
    }

    var fileName: String { "\(number)-riferimento-\(rawValue).png" }
}

enum Category: String, CaseIterable, Identifiable {
    case ring = "Anello"
    case bracelet = "Bracciale"
    case necklace = "Collana"
    case earring = "Orecchini"
    case charm = "Ciondolo / charm"
    case other = "Altro gioiello"
    var id: String { rawValue }
}

enum StudioIssue: LocalizedError {
    case invalidImage
    case missingProduct
    case missingReferences
    case cannotCreatePNG
    case chatGPTNotFound

    var errorDescription: String? {
        switch self {
        case .invalidImage: return "Il file selezionato non è un'immagine leggibile."
        case .missingProduct: return "Seleziona la fotografia del gioiello."
        case .missingReferences: return "Carica tutte e quattro le immagini di riferimento."
        case .cannotCreatePNG: return "Impossibile convertire l'immagine in PNG."
        case .chatGPTNotFound: return "ChatGPT non è installato. Apriremo chatgpt.com nel browser."
        }
    }
}

@MainActor
final class StudioModel: ObservableObject {
    @Published var productURL: URL?
    @Published var productName: String = ""
    @Published var category: Category = .ring
    @Published var details: String = ""
    @Published var references: [Shot: URL] = [:]
    @Published var status: String = "Carica il prodotto e le quattro reference per iniziare."
    @Published var preparedFolder: URL?
    @Published var enableAutoPaste: Bool = true
    @Published var lastPreparationSucceeded = false
    @Published var isAutoAttaching = false

    private let fm = FileManager.default
    private let preferences = UserDefaults.standard

    init() {
        enableAutoPaste = preferences.object(forKey: "enableAutoPaste") as? Bool ?? true
        loadReferences()
    }

    private var referenceFolder: URL {
        let support = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return support.appendingPathComponent("AdamantePhotoStudio/References", isDirectory: true)
    }

    var isReady: Bool {
        productURL != nil && Shot.allCases.allSatisfy { references[$0] != nil }
    }

    var referenceCount: Int { references.count }

    func selectProduct() {
        let dialog = NSOpenPanel()
        dialog.allowedContentTypes = [.image]
        dialog.canChooseFiles = true
        dialog.canChooseDirectories = false
        dialog.allowsMultipleSelection = false
        dialog.prompt = "Usa fotografia"
        if dialog.runModal() == .OK, let url = dialog.url {
            guard NSImage(contentsOf: url) != nil else {
                status = StudioIssue.invalidImage.localizedDescription
                return
            }
            productURL = url
            productName = url.deletingPathExtension().lastPathComponent
                .replacingOccurrences(of: "_", with: " ")
            preparedFolder = nil
            lastPreparationSucceeded = false
            status = "Fotografia selezionata. I dettagli del prodotto resteranno prioritari."
        }
    }

    func selectReference(_ shot: Shot) {
        let dialog = NSOpenPanel()
        dialog.allowedContentTypes = [.image]
        dialog.canChooseFiles = true
        dialog.canChooseDirectories = false
        dialog.allowsMultipleSelection = false
        dialog.prompt = "Salva riferimento"
        guard dialog.runModal() == .OK, let source = dialog.url else { return }

        do {
            let data = try pngData(from: source, maxEdge: 1500)
            try fm.createDirectory(at: referenceFolder, withIntermediateDirectories: true)
            let destination = referenceFolder.appendingPathComponent("\(shot.rawValue).png")
            try data.write(to: destination, options: .atomic)
            references[shot] = destination
            status = "Reference \(shot.number) salvata sul Mac."
        } catch {
            status = "Non è stato possibile salvare il riferimento: \(error.localizedDescription)"
        }
    }

    func removeReference(_ shot: Shot) {
        if let url = references[shot] {
            try? fm.removeItem(at: url)
        }
        references.removeValue(forKey: shot)
        status = "Reference \(shot.number) rimossa."
    }

    private func loadReferences() {
        for shot in Shot.allCases {
            let file = referenceFolder.appendingPathComponent("\(shot.rawValue).png")
            if fm.fileExists(atPath: file.path) {
                references[shot] = file
            }
        }
    }

    func setAutoPaste(_ enabled: Bool) {
        enableAutoPaste = enabled
        preferences.set(enabled, forKey: "enableAutoPaste")
    }

    func requestAccessibility() {
        let options: NSDictionary = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true]
        if AXIsProcessTrustedWithOptions(options) {
            status = "Permesso Accessibilità già concesso."
        } else {
            status = "In Impostazioni di Sistema > Privacy e sicurezza > Accessibilità, autorizza Adamante Photo Studio. La concessione può richiedere il riavvio dell'app."
        }
    }

    func prepare() {
        guard let productURL else {
            status = StudioIssue.missingProduct.localizedDescription
            return
        }
        guard Shot.allCases.allSatisfy({ references[$0] != nil }) else {
            status = StudioIssue.missingReferences.localizedDescription
            return
        }

        do {
            let now = DateFormatter()
            now.dateFormat = "yyyy-MM-dd_HH-mm-ss"
            let filename = sanitizedName(productName.isEmpty ? "gioiello" : productName)
            let root = fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
                .appendingPathComponent("Adamante Photo Studio/Lavorazioni", isDirectory: true)
            let folder = root.appendingPathComponent("\(now.string(from: Date()))_\(filename)", isDirectory: true)
            try fm.createDirectory(at: folder, withIntermediateDirectories: true)

            let originalDestination = folder.appendingPathComponent("00-foto-prodotto-originale.png")
            let data = try pngData(from: productURL, maxEdge: 2200)
            try data.write(to: originalDestination, options: .atomic)

            var images = [originalDestination]
            for shot in Shot.allCases {
                let destination = folder.appendingPathComponent(shot.fileName)
                try fm.copyItem(at: references[shot]!, to: destination)
                images.append(destination)
            }

            let prompt = makePrompt()
            try prompt.write(to: folder.appendingPathComponent("ISTRUZIONI-CHATGPT.txt"), atomically: true, encoding: .utf8)

            preparedFolder = folder
            lastPreparationSucceeded = true
            copyPrompt(prompt)
            NSWorkspace.shared.activateFileViewerSelecting(images)
            status = "Preparati cinque PNG. Sto aprendo ChatGPT; controlla sempre che siano presenti cinque allegati PRIMA di inviare."
            openChatGPTAndOptionallyPaste(images: images)
        } catch {
            status = "Preparazione non riuscita: \(error.localizedDescription)"
            lastPreparationSucceeded = false
        }
    }

    func copyPromptAgain() {
        copyPrompt(makePrompt())
        status = "Prompt copiato. Incollalo in una nuova chat ChatGPT con ⌘V."
    }

    func showPreparedFolder() {
        guard let preparedFolder else { return }
        NSWorkspace.shared.open(preparedFolder)
    }

    func openChatGPTAgain() {
        guard let folder = preparedFolder else { return }
        let images = [folder.appendingPathComponent("00-foto-prodotto-originale.png")] + Shot.allCases.map { folder.appendingPathComponent($0.fileName) }
        openChatGPTAndOptionallyPaste(images: images)
    }

    private func copyPrompt(_ prompt: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(prompt, forType: .string)
    }

    private func openChatGPTAndOptionallyPaste(images: [URL]) {
        let appPaths = [
            "/Applications/ChatGPT.app",
            NSHomeDirectory() + "/Applications/ChatGPT.app"
        ]
        let candidate: URL? = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.openai.chat")
            ?? NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.openai.chatgpt")
            ?? appPaths.first(where: { fm.fileExists(atPath: $0) }).map { URL(fileURLWithPath: $0) }

        guard let candidate else {
            if let url = URL(string: "https://chatgpt.com/") {
                NSWorkspace.shared.open(url)
            }
            status = "ChatGPT aperto nel browser. Trascina prima i cinque PNG da Finder, verifica cinque anteprime, poi incolla il prompt con ⌘V e invia."
            return
        }

        let config = NSWorkspace.OpenConfiguration()
        config.activates = true
        NSWorkspace.shared.openApplication(at: candidate, configuration: config) { [weak self] application, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let error {
                    self.status = "Impossibile aprire ChatGPT: \(error.localizedDescription). I cinque file sono pronti in Finder."
                    return
                }

                guard self.enableAutoPaste else {
                    self.status = "ChatGPT aperto. Trascina PRIMA i cinque PNG da Finder e controlla le anteprime; poi incolla il prompt (⌘V) e invia."
                    return
                }

                guard AXIsProcessTrusted(), let app = application else {
                    self.status = "Per tentare l'allegato automatico serve il permesso Accessibilità. Altrimenti trascina i cinque PNG da Finder, verifica cinque anteprime e incolla il prompt (⌘V)."
                    return
                }

                // Best effort: ChatGPT non dispone di un'API per allegare file da applicazioni esterne.
                // Proviamo a incollare le immagini REALI negli appunti una per volta, prima del prompt.
                // Non inviamo mai il messaggio: l'utente deve controllare cinque anteprime.
                self.isAutoAttaching = true
                self.status = "Apro una nuova chat, poi tento di aggiungere le cinque fotografie prima del prompt..."
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    app.activate(options: [.activateAllWindows])
                    // Ctrl+1: torna alla modalità Chat, se la scorciatoia è supportata.
                    self.keystroke(virtualKey: 18, modifiers: .maskControl)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
                        self.keystroke(virtualKey: 45, modifiers: .maskCommand) // ⌘N
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                            self.attemptPasteImages(images, in: app, index: 0)
                        }
                    }
                }
            }
        }
    }

    private func attemptPasteImages(_ urls: [URL], in app: NSRunningApplication, index: Int) {
        guard isAutoAttaching else { return }

        // Mai incollare altrove se l'utente ha cambiato applicazione.
        guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else {
            finishAutoAttach(app, message: "L'automazione si è interrotta perché ChatGPT non era in primo piano. Trascina i cinque PNG da Finder e incolla il prompt (⌘V).", showNotice: false)
            return
        }

        guard index < urls.count else {
            // Reinseriamo il prompt negli appunti DOPO aver tentato le cinque immagini.
            copyPrompt(makePrompt())
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else {
                    self.finishAutoAttach(app, message: "Foto tentate, ma ChatGPT non era in primo piano per il prompt. Usa «Copia nuovamente il prompt». Controlla le cinque anteprime.", showNotice: false)
                    return
                }
                self.keystroke(virtualKey: 9, modifiers: .maskCommand) // ⌘V: prompt
                self.finishAutoAttach(app, message: "Inserimento tentato. NON inviare se non vedi cinque miniature allegate: in quel caso trascina i PNG da Finder.", showNotice: true)
            }
            return
        }

        guard let image = NSImage(contentsOf: urls[index]) else {
            finishAutoAttach(app, message: "Immagine \(index + 1) non leggibile. Trascina manualmente tutti i cinque PNG da Finder.", showNotice: true)
            return
        }

        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        guard pasteboard.writeObjects([image]) else {
            finishAutoAttach(app, message: "Non è stato possibile copiare l'immagine \(index + 1). Trascina i cinque PNG da Finder.", showNotice: true)
            return
        }
        keystroke(virtualKey: 9, modifiers: .maskCommand) // ⌘V: immagine negli appunti
        status = "Tentativo allegato \(index + 1) di \(urls.count). Attendi e controlla le anteprime in ChatGPT."
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            self.attemptPasteImages(urls, in: app, index: index + 1)
        }
    }

    private func finishAutoAttach(_ app: NSRunningApplication, message: String, showNotice: Bool) {
        isAutoAttaching = false
        copyPrompt(makePrompt()) // Fallback sempre disponibile in ⌘V.
        status = message
        guard showNotice else { return }
        let alert = NSAlert()
        alert.messageText = "Controlla le 5 foto prima di inviare"
        alert.informativeText = "L'app ha TENTATO di incollare le cinque immagini e il prompt, ma non può verificare gli allegati. Se non vedi cinque miniature nella chat, NON premere Invio: trascina i cinque PNG dalla cartella aperta in Finder. Poi controlla il prompt e invia."
        alert.alertStyle = .informational
        alert.addButton(withTitle: "Controllo in ChatGPT")
        alert.runModal()
        app.activate(options: [.activateAllWindows])
    }

    private func keystroke(virtualKey: CGKeyCode, modifiers: CGEventFlags) {
        guard let down = CGEvent(keyboardEventSource: nil, virtualKey: virtualKey, keyDown: true),
              let up = CGEvent(keyboardEventSource: nil, virtualKey: virtualKey, keyDown: false) else { return }
        down.flags = modifiers
        up.flags = modifiers
        down.post(tap: .cghidEventTap)
        up.post(tap: .cghidEventTap)
    }

    private func sanitizedName(_ value: String) -> String {
        let folded = value.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "it_IT"))
        let filtered = folded.map { char -> Character in
            char.isLetter || char.isNumber ? char : "-"
        }
        let joined = String(filtered).split(separator: "-").joined(separator: "-")
        return String(joined.prefix(55)).isEmpty ? "gioiello" : String(joined.prefix(55))
    }

    private func pngData(from url: URL, maxEdge: CGFloat) throws -> Data {
        guard let image = NSImage(contentsOf: url) else { throw StudioIssue.invalidImage }
        let size = image.size
        guard size.width > 0, size.height > 0 else { throw StudioIssue.invalidImage }
        let scale = min(1.0, maxEdge / max(size.width, size.height))
        let width = max(1, Int((size.width * scale).rounded()))
        let height = max(1, Int((size.height * scale).rounded()))
        guard let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
            colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
        ), let graphics = NSGraphicsContext(bitmapImageRep: bitmap) else {
            throw StudioIssue.cannotCreatePNG
        }
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = graphics
        image.draw(in: NSRect(x: 0, y: 0, width: width, height: height),
                   from: NSRect(origin: .zero, size: size), operation: .copy, fraction: 1)
        graphics.flushGraphics()
        NSGraphicsContext.restoreGraphicsState()
        guard let data = bitmap.representation(using: .png, properties: [:]) else {
            throw StudioIssue.cannotCreatePNG
        }
        return data
    }

    private func makePrompt() -> String {
        let details = details.trimmingCharacters(in: .whitespacesAndNewlines)
        return """
        ADAMANTE — PROTOCOLLO FOTOGRAFICO E-COMMERCE

        RUOLO
        Sei un fotografo e ritoccatore di alta gioielleria specializzato in still-life luxury.
        Devi realizzare QUATTRO FOTO SEPARATE, quadrate (1:1), su sfondo bianco, coerenti tra loro.

        ALLEGATI (leggi i nomi dei file, non confondere i ruoli):
        - 00-foto-prodotto-originale.png: IL VERO GIOIELLO DA RIPRODURRE. È la fonte prioritaria per colori, forma e struttura.
        - 01-riferimento-main.png: stile per foto prodotto a tre quarti.
        - 02-riferimento-front.png: stile per vista frontale / seconda angolazione.
        - 03-riferimento-worn.png: stile per foto indossata.
        - 04-riferimento-packaging.png: stile per scrigno in velluto bordeaux e interno avorio.
        Se ChatGPT mostra immagini incollate con nomi generici, usa l\'ORDINE degli allegati: 1) prodotto originale; 2) main; 3) front; 4) worn; 5) packaging.

        ARTICOLO
        Nome: \(productName.isEmpty ? "Gioiello Adamante" : productName)
        Categoria: \(category.rawValue)
        \(details.isEmpty ? "" : "Dettagli da preservare: " + String(details.prefix(1600)))

        VINCOLI NON NEGOZIABILI
        1. NON copiare il gioiello presente nelle reference: copiane soltanto illuminazione, inquadratura, fondale e linguaggio visivo.
        2. Mantieni il gioiello originale il più fedele possibile: numero e posizione delle pietre, colori, tagli, riflessi, montatura, proporzioni, finiture e incisioni.
        3. Non aggiungere pietre, loghi, scritte, decorazioni o elementi non presenti. Se un dettaglio non è visibile nell'originale, evita di inventarlo.
        4. Fotografia commerciale nitidissima, materiali realistici, luce morbida e controllata, ombre di contatto naturali. Niente collage, watermark, scritte, bordi o etichette.
        5. Risultati QUADRATI e separati, uno per ciascun tipo di scatto.

        LE QUATTRO GENERAZIONI
        01. PRODOTTO PRINCIPALE — Gioiello isolato, angolo a tre quarti, bianco puro, ombra morbida.
        02. ALTRA PROSPETTIVA — Vista frontale/complementare che valorizza struttura e incastonatura; stesso prodotto e stesso stile.
        03. INDOSSATO — Gioiello indossato in modo anatomico realistico: mano per anello, polso per bracciale, collo per collana, orecchio per orecchini. Pelle naturale, nessun altro gioiello.
        04. PACKAGING — Gioiello dentro uno scrigno aperto con esterno in velluto bordeaux intenso, interno imbottito avorio, fondale bianco, senza loghi inventati.

        ESECUZIONE
        Genera le quattro fotografie come immagini DISTINTE, non come collage.
        Se puoi produrle tutte nel messaggio, procedi in ordine 01→04. Se il sistema ti permette
        di generarne solo una per volta, genera subito la 01 e poi continua su richiesta
        con la 02, la 03 e la 04. Non sostituire le foto con descrizioni testuali.

        Attenzione: controlla le caratteristiche del prodotto originale rispetto a ogni immagine.
        """
    }
}

private struct ReferenceTile: View {
    let shot: Shot
    let url: URL?
    let onChoose: () -> Void
    let onRemove: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 7).fill(Color(red: 0.96, green: 0.95, blue: 0.93))
                if let url, let image = NSImage(contentsOf: url) {
                    Image(nsImage: image)
                        .resizable().scaledToFit()
                        .padding(2)
                } else {
                    Image(systemName: "photo")
                        .font(.system(size: 22, weight: .ultraLight))
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 67, height: 67)
            .clipped()

            VStack(alignment: .leading, spacing: 5) {
                Text(shot.number + " / " + shot.name)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color(red: 0.19, green: 0.15, blue: 0.14))
                Text(shot.hint)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 13) {
                    Button(url == nil ? "Carica" : "Sostituisci", action: onChoose)
                        .buttonStyle(.plain)
                        .foregroundStyle(Color(red: 0.48, green: 0.18, blue: 0.25))
                        .font(.system(size: 11, weight: .medium))
                    if url != nil {
                        Button("Rimuovi", action: onRemove)
                            .buttonStyle(.plain)
                            .foregroundStyle(.secondary)
                            .font(.system(size: 11))
                    }
                }
            }
            Spacer(minLength: 0)
            if url != nil { Image(systemName: "checkmark.circle.fill").foregroundStyle(.green) }
        }
        .padding(11)
        .background(Color.white.opacity(0.9))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.black.opacity(0.08)))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

struct StudioView: View {
    @StateObject private var model = StudioModel()
    private let wine = Color(red: 0.44, green: 0.14, blue: 0.23)
    private let paper = Color(red: 0.97, green: 0.96, blue: 0.94)

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                ZStack {
                    Rectangle().fill(Color(red: 0.15, green: 0.12, blue: 0.12))
                        .frame(width: 35, height: 35).rotationEffect(.degrees(45))
                    Text("A").font(.system(size: 23, weight: .regular, design: .serif))
                        .foregroundStyle(Color(red: 0.83, green: 0.7, blue: 0.53))
                }
                .frame(width: 48, height: 48)
                VStack(alignment: .leading, spacing: 3) {
                    Text("ADAMANTE")
                        .font(.system(size: 15, weight: .medium, design: .serif))
                        .tracking(3)
                    Text("PHOTO STUDIO   /   macOS")
                        .font(.system(size: 9, weight: .medium))
                        .tracking(2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Label("Nessuna chiave API richiesta", systemImage: "checkmark.shield")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 32)
            .padding(.vertical, 19)
            .background(Color.white)

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("IL TUO ATELIER DIGITALE")
                            .font(.system(size: 10, weight: .semibold)).tracking(2.7)
                            .foregroundStyle(Color(red: 0.61, green: 0.46, blue: 0.3))
                        (
                            Text("Ogni gioiello, ").foregroundColor(.primary)
                            + Text("quattro prospettive.").italic().foregroundColor(wine)
                        )
                        .font(.system(size: 34, weight: .regular, design: .serif))
                        Text("Prepara una nuova conversazione con ChatGPT, senza API né costi aggiuntivi.")
                            .font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                    HStack(alignment: .top, spacing: 22) {
                        VStack(alignment: .leading, spacing: 12) {
                            sectionTitle("01 / PRODOTTO", "Fotografia originale")
                            ZStack {
                                RoundedRectangle(cornerRadius: 10).fill(Color.white)
                                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.black.opacity(0.09)))
                                if let url = model.productURL, let image = NSImage(contentsOf: url) {
                                    Image(nsImage: image).resizable().scaledToFit().padding(12)
                                } else {
                                    VStack(spacing: 11) {
                                        Image(systemName: "square.and.arrow.up")
                                            .font(.system(size: 29, weight: .ultraLight)).foregroundStyle(wine)
                                        Text("Carica la foto del gioiello").font(.system(size: 12, weight: .medium))
                                        Text("PNG · JPG · HEIC · WEBP")
                                            .font(.system(size: 10)).foregroundStyle(.secondary)
                                    }
                                }
                            }
                            .frame(height: 185)
                            Button(action: model.selectProduct) {
                                Label(model.productURL == nil ? "Seleziona la foto" : "Cambia la foto", systemImage: "plus")
                                    .frame(maxWidth: .infinity).padding(.vertical, 10)
                            }
                            .buttonStyle(.bordered)

                            Text("NOME O CODICE ARTICOLO")
                                .font(.system(size: 9, weight: .semibold)).tracking(1.2)
                                .foregroundStyle(.secondary)
                            TextField("Es. Anello smeraldo 001", text: $model.productName)
                                .textFieldStyle(.roundedBorder)

                            Text("CATEGORIA")
                                .font(.system(size: 9, weight: .semibold)).tracking(1.2)
                                .foregroundStyle(.secondary)
                            Picker("Categoria", selection: $model.category) {
                                ForEach(Category.allCases) { item in Text(item.rawValue).tag(item) }
                            }
                            .labelsHidden().frame(maxWidth: .infinity)

                            Text("DETTAGLI DA NON ALTERARE")
                                .font(.system(size: 9, weight: .semibold)).tracking(1.2)
                                .foregroundStyle(.secondary)
                            TextEditor(text: $model.details)
                                .font(.system(size: 12))
                                .scrollContentBackground(.hidden)
                                .padding(8)
                                .frame(height: 93)
                                .background(Color.white)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.black.opacity(0.09)))
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                sectionTitle("02 / IDENTITÀ VISIVA", "Reference Adamante")
                                Spacer()
                                Text("\(model.referenceCount)/4")
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(wine)
                            }
                            Text("Caricale una volta: restano salvate su questo Mac e vengono aggiunte a ogni nuova lavorazione.")
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)

                            ForEach(Shot.allCases) { shot in
                                ReferenceTile(
                                    shot: shot,
                                    url: model.references[shot],
                                    onChoose: { model.selectReference(shot) },
                                    onRemove: { model.removeReference(shot) }
                                )
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Divider()
                    HStack(alignment: .center, spacing: 18) {
                        Toggle("Tenta di allegare le 5 foto e il prompt in ChatGPT", isOn: Binding(
                            get: { model.enableAutoPaste },
                            set: { model.setAutoPaste($0) }
                        ))
                        .font(.system(size: 11))
                        .toggleStyle(.checkbox)
                        Button("Autorizza Accessibilità") { model.requestAccessibility() }
                            .font(.system(size: 11))
                            .buttonStyle(.link)
                        Spacer()
                        Button(action: model.prepare) {
                            HStack(spacing: 10) {
                                Image(systemName: "sparkles")
                                Text("Prepara su ChatGPT")
                                Image(systemName: "arrow.up.right")
                            }
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.white)
                            .padding(.vertical, 13).padding(.horizontal, 19)
                            .background(model.isReady ? wine : Color.gray)
                            .clipShape(RoundedRectangle(cornerRadius: 7))
                        }
                        .buttonStyle(.plain)
                        .disabled(!model.isReady || model.isAutoAttaching)
                    }
                    HStack(alignment: .top, spacing: 11) {
                        Image(systemName: "info.circle").foregroundStyle(wine)
                        Text(model.status)
                            .font(.system(size: 11))
                            .foregroundStyle(Color(red: 0.43, green: 0.36, blue: 0.33))
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer()
                    }
                    .padding(13)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(red: 0.93, green: 0.90, blue: 0.85))
                    .clipShape(RoundedRectangle(cornerRadius: 7))
                    if model.preparedFolder != nil {
                        VStack(alignment: .leading, spacing: 7) {
                            Label("OBBLIGATORIO: CONTROLLA CINQUE ALLEGATI", systemImage: "exclamationmark.triangle.fill")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(wine)
                            Text("Prima di premere Invio su ChatGPT devono esserci 5 miniature: prodotto + 4 reference. Se mancano, trascina i cinque PNG dalla cartella Finder preparata, poi incolla il prompt con ⌘V.")
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(red: 1.0, green: 0.94, blue: 0.89))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        HStack(spacing: 19) {
                            Button("Apri la cartella delle immagini") { model.showPreparedFolder() }
                            Button("Copia nuovamente il prompt") { model.copyPromptAgain() }
                            Button("Apri nuovamente ChatGPT") { model.openChatGPTAgain() }
                        }
                        .font(.system(size: 11))
                        .buttonStyle(.link)
                    }
                }
                .padding(31)
            }
            .background(paper)
            HStack {
                Text("ADAMANTE PHOTO STUDIO")
                Spacer()
                Text("5 IMMAGINI · 1 PROMPT · 4 SCATTI")
                Spacer()
                Text("PREPARA E VERIFICA PRIMA DI INVIARE")
            }
            .font(.system(size: 9, weight: .medium))
            .tracking(1.3)
            .foregroundStyle(.secondary)
            .padding(.horizontal, 31).padding(.vertical, 13)
            .background(Color.white)
        }
        .frame(minWidth: 840, minHeight: 780)
    }

    private func sectionTitle(_ kicker: String, _ title: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(kicker)
                .font(.system(size: 9, weight: .semibold))
                .tracking(1.5)
                .foregroundStyle(Color(red: 0.62, green: 0.46, blue: 0.3))
            Text(title)
                .font(.system(size: 22, weight: .regular, design: .serif))
        }
    }
}

@main
struct AdamantePhotoStudioApp: App {
    var body: some Scene {
        WindowGroup {
            StudioView()
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 1010, height: 830)
    }
}
