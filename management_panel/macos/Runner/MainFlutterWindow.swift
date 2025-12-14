import Cocoa
import FlutterMacOS

class MainFlutterWindow: NSWindow, NSTouchBarDelegate {
  var flutterMethodChannel: FlutterMethodChannel?
  var isLoggedIn = false

  override func awakeFromNib() {
    let flutterViewController = FlutterViewController()
    let windowFrame = self.frame
    self.contentViewController = flutterViewController
    self.setFrame(windowFrame, display: true)

    // Create method channel for communication with Flutter
    flutterMethodChannel = FlutterMethodChannel(name: "com.example.management_panel/touchbar",
                                                binaryMessenger: flutterViewController.engine.binaryMessenger)

    // Set up method call handler for communication from Flutter
    flutterMethodChannel?.setMethodCallHandler({ [weak self] (call: FlutterMethodCall, result: @escaping FlutterResult) in
      if call.method == "setLoginStatus" {
        if let isLoggedIn = call.arguments as? Bool {
          self?.isLoggedIn = isLoggedIn
          // Update the Touch Bar
          self?.touchBar = self?.makeTouchBar()
        }
        result(nil)
      } else {
        result(FlutterMethodNotImplemented)
      }
    })

    RegisterGeneratedPlugins(registry: flutterViewController)

    super.awakeFromNib()
  }

  override func makeTouchBar() -> NSTouchBar? {
    let touchBar = NSTouchBar()
    touchBar.delegate = self
    if isLoggedIn {
      touchBar.defaultItemIdentifiers = [.membersButton, .serverSelectorButton, .updateButton, .restartButton]
    } else {
      touchBar.defaultItemIdentifiers = [.loginMessage]
    }
    return touchBar
  }

  func touchBar(_ touchBar: NSTouchBar, makeItemForIdentifier identifier: NSTouchBarItem.Identifier) -> NSTouchBarItem? {
    switch identifier {
    case .loginMessage:
      let item = NSCustomTouchBarItem(identifier: identifier)
      let textField = NSTextField(labelWithString: "Please login to your Discord bot!")
      textField.alignment = .center
      item.view = textField
      return item
    case .membersButton:
      let item = NSCustomTouchBarItem(identifier: identifier)
      let button = NSButton(title: "Members", target: self, action: #selector(membersPressed))
      button.bezelColor = NSColor.blue
      item.view = button
      return item
    case .serverSelectorButton:
      let item = NSPopoverTouchBarItem(identifier: identifier)
      item.collapsedRepresentationLabel = "Server"
      item.popoverTouchBar = createServerSelectionTouchBar()
      return item
    case .updateButton:
      let item = NSCustomTouchBarItem(identifier: identifier)
      let button = NSButton(title: "Update", target: self, action: #selector(updatePressed))
      button.bezelColor = NSColor.blue
      item.view = button
      return item
    case .restartButton:
      let item = NSCustomTouchBarItem(identifier: identifier)
      let button = NSButton(title: "Restart", target: self, action: #selector(restartPressed))
      button.bezelColor = NSColor.blue
      item.view = button
      return item
    case .selectServer1:
      let item = NSCustomTouchBarItem(identifier: identifier)
      let button = NSButton(title: "Main Server", target: self, action: #selector(selectServer1))
      button.bezelColor = NSColor.gray
      item.view = button
      return item
    case .selectServer2:
      let item = NSCustomTouchBarItem(identifier: identifier)
      let button = NSButton(title: "Test Server", target: self, action: #selector(selectServer2))
      button.bezelColor = NSColor.gray
      item.view = button
      return item
    default:
      return nil
    }
  }

  func createServerSelectionTouchBar() -> NSTouchBar {
    let touchBar = NSTouchBar()
    touchBar.delegate = self
    touchBar.defaultItemIdentifiers = [.selectServer1, .selectServer2]
    return touchBar
  }

  @objc func membersPressed() {
    flutterMethodChannel?.invokeMethod("showMembers", arguments: nil)
  }

  @objc func selectServer1() {
    flutterMethodChannel?.invokeMethod("selectServer", arguments: "1")
  }

  @objc func selectServer2() {
    flutterMethodChannel?.invokeMethod("selectServer", arguments: "2")
  }

  @objc func updatePressed() {
    flutterMethodChannel?.invokeMethod("updateBot", arguments: nil)
  }

  @objc func restartPressed() {
    flutterMethodChannel?.invokeMethod("restartBot", arguments: nil)
  }
}

extension NSTouchBarItem.Identifier {
  static let loginMessage = NSTouchBarItem.Identifier("com.example.loginMessage")
  static let membersButton = NSTouchBarItem.Identifier("com.example.membersButton")
  static let serverSelectorButton = NSTouchBarItem.Identifier("com.example.serverSelectorButton")
  static let selectServer1 = NSTouchBarItem.Identifier("com.example.selectServer1")
  static let selectServer2 = NSTouchBarItem.Identifier("com.example.selectServer2")
  static let updateButton = NSTouchBarItem.Identifier("com.example.updateButton")
  static let restartButton = NSTouchBarItem.Identifier("com.example.restartButton")
}
