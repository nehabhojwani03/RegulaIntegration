import React from 'react'
import { SafeAreaView, ScrollView, StyleSheet, Text, View, NativeEventEmitter, Platform, TouchableOpacity, Image, Button } from 'react-native'
import DocumentReader, { Enum, DocumentReaderCompletion, DocumentReaderScenario, RNRegulaDocumentReader, DocumentReaderResults, DocumentReaderNotification, ScannerConfig, RecognizeConfig, DocReaderConfig, Functionality } from '@regulaforensics/react-native-document-reader-api'
import * as RNFS from 'react-native-fs'
import RadioGroup, { RadioButtonProps } from 'react-native-radio-buttons-group'
import { CheckBox } from '@rneui/themed'
import { launchImageLibrary } from 'react-native-image-picker'
import * as Progress from 'react-native-progress'

var isReadingRfid = false

interface IProps {
}

interface IState {
  documentNumber: string | undefined
  fullName: string | undefined
  dateOfBirth: string | undefined
  dateOfIssue: string | undefined
  issuingStateCode: string | undefined
  issuingState: string | undefined
  addressState: string | undefined
  age: string | undefined
  otherPersonName: string | undefined
  yearSinceIssue: string | undefined
  ageAtIssue: string | undefined
  doRfid: boolean
  isReadingRfidCustomUi: boolean
  rfidUIHeader: string
  rfidUIHeaderColor: string
  rfidDescription: string
  rfidProgress: number
  canRfid: boolean
  canRfidTitle: string
  radioButtons: any
  selectedScenario: string
  portrait: any
  docFront: any
  signature:any
  other:any
}

export default class DocumentSdkScreen extends React.Component<IProps, IState> {
  onInitialized() {
    this.setState({ fullName: "Ready" })

    var functionality = new Functionality()
    functionality.showCaptureButton = true
    DocumentReader.setFunctionality(functionality, _ => { }, _ => { })
  }

  constructor(props: {} | Readonly<{}>) {
    super(props)
    // Icon.loadFont()

    var eventManager = new NativeEventEmitter(RNRegulaDocumentReader)
    eventManager.addListener('completion', (e) => this.handleCompletion(DocumentReaderCompletion.fromJson(JSON.parse(e["msg"]))!))
    eventManager.addListener('rfidOnProgressCompletion', e => this.updateRfidUI(DocumentReaderNotification.fromJson(JSON.parse(e["msg"]))!))

    var licPath = Platform.OS === 'ios' ? (RNFS.MainBundlePath + "/regula.license") : "regula.license"
    var readFile = Platform.OS === 'ios' ? RNFS.readFile : RNFS.readFileAssets
    readFile(licPath, 'base64').then((res) => {
      this.setState({ fullName: "Initializing..." })
      var config = new DocReaderConfig()
      config.license = res
      config.delayedNNLoad = true
      DocumentReader.initializeReader(config, (response) => {
        if (!JSON.parse(response)["success"]) {
          console.log(response)
          return
        }
        console.log("Init complete")
        DocumentReader.getIsRFIDAvailableForUse((canRfid) => {
          if (canRfid) {
            this.setState({ canRfid: true, rfidUIHeader: "Reading RFID", rfidDescription: "Place your phone on top of the NFC tag", rfidUIHeaderColor: "black" })
            this.setState({ canRfidTitle: '' })
          }
        }, error => console.log(error))
        this.setState({ selectedScenario: "FullProcess" });

        this.onInitialized()
      }, error => console.log(error))
    })

    this.state = {
      documentNumber: '',
      fullName: '',
      dateOfBirth: '',
      dateOfIssue: '',
      issuingStateCode: '',
      issuingState: '',
      addressState: '',
      age: '',
      otherPersonName: '',
      yearSinceIssue: '',
      ageAtIssue: '',
      doRfid: false,
      isReadingRfidCustomUi: false,
      rfidUIHeader: "",
      rfidUIHeaderColor: "black",
      rfidDescription: "",
      rfidProgress: -1,
      canRfid: false,
      canRfidTitle: "(unavailable)",
      radioButtons: [{ label: 'Loading', id: "0" }],
      selectedScenario: "",
      portrait: require('../images/portrait.png'),
      docFront: require('../images/id.png'),
      signature: require('../images/id.png'),
      other: require('../images/portrait.png'),
    }
  }

  handleCompletion(completion: DocumentReaderCompletion) {
    console.log("Inside handleCompletion");
    if (this.state.isReadingRfidCustomUi) {
      if (completion.action == Enum.DocReaderAction.ERROR) this.restartRfidUI()
      if (this.actionSuccess(completion.action!) || this.actionError(completion.action!)) {
        this.hideRfidUI()
        this.displayResults(completion.results!)
      }
    } else if (this.actionSuccess(completion.action!) || this.actionError(completion.action!))
      this.handleResults(completion.results!)
  }

  actionSuccess(action: number) {
    if (action == Enum.DocReaderAction.COMPLETE || action == Enum.DocReaderAction.TIMEOUT) return true
    return false
  }

  actionError(action: number) {
    if (action == Enum.DocReaderAction.CANCEL || action == Enum.DocReaderAction.ERROR) return true
    return false
  }

  showRfidUI() {
    // show animation
    this.setState({ isReadingRfidCustomUi: true })
  }

  hideRfidUI() {
    // show animation
    DocumentReader.stopRFIDReader(_ => { }, _ => { });
    this.restartRfidUI()
    this.setState({ isReadingRfidCustomUi: false, rfidUIHeader: "Reading RFID", rfidUIHeaderColor: "black" })
  }

  restartRfidUI() {
    this.setState({ rfidUIHeaderColor: "red", rfidUIHeader: "Failed!", rfidDescription: "Place your phone on top of the NFC tag", rfidProgress: -1 })
  }

  updateRfidUI(notification: DocumentReaderNotification) {
    if (notification.notificationCode === Enum.eRFID_NotificationCodes.RFID_NOTIFICATION_PCSC_READING_DATAGROUP)
      this.setState({ rfidDescription: "ERFIDDataFileType: " + notification.dataFileType })
    this.setState({ rfidUIHeader: "Reading RFID", rfidUIHeaderColor: "black" })
    if (notification.progress != null)
      this.setState({ rfidProgress: notification.progress / 100 })
    if (Platform.OS === 'ios')
      DocumentReader.setRfidSessionStatus(this.state.rfidDescription + "\n" + notification.progress + "%", e => { }, e => { })
  }

  clearResults() {
    this.setState({ fullName: "Ready", docFront: require('../images/id.png'), portrait: require('../images/portrait.png'), signature: require('../images/id.png'),other: require('../images/portrait.png')})
  }

  scan() {
    console.log("Inside Scan");
    this.clearResults()
    var config = new ScannerConfig()
    // config.scenario = this.state.selectedScenario
    config.scenario = "FullProcess";
    DocumentReader.scan(config, _ => { }, e => console.log(e))
  }

  recognize() {
    console.log("Inside Recognize");
    launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      selectionLimit: 10
    }, r => {
      if (r.errorCode != null) {
        console.log("error code: " + r.errorCode)
        console.log("error message: " + r.errorMessage)
        this.setState({ fullName: r.errorMessage })
        return
      }
      if (r.didCancel) return
      this.clearResults()
      this.setState({ fullName: "COPYING IMAGE..." })
      var response = r.assets

      var images: any = []

      for (var i = 0; i < response!.length; i++) {
        images.push(response![i].base64!)
      }
      this.setState({ fullName: "PROCESSING..." })

      var config = new RecognizeConfig()
      // config.scenario = this.state.selectedScenario
      config.scenario = "FullProcess";
      config.images = images
      DocumentReader.recognize(config, _ => { }, e => console.log(e))
    })
  }

  displayResults(results: DocumentReaderResults) {
    console.log("Inside display Result")
    if (results == null) return

    //Document Number
    results.textFieldValueByType(Enum.eVisualFieldType.FT_DOCUMENT_NUMBER, (value: string | undefined) => {
      this.setState({ documentNumber: value })
    }, (error: string) => console.log(error))

    //Name
    results.textFieldValueByType(Enum.eVisualFieldType.FT_SURNAME_AND_GIVEN_NAMES, (value: string | undefined) => {
      this.setState({ fullName: value })
    }, (error: string) => console.log(error))

    //Date of birth
    results.textFieldValueByType(Enum.eVisualFieldType.FT_DATE_OF_BIRTH, (value: string | undefined) => {
      this.setState({ dateOfBirth: value })
    }, (error: string) => console.log(error))

    //date of issue
    results.textFieldValueByType(Enum.eVisualFieldType.FT_DATE_OF_ISSUE, (value: string | undefined) => {
      this.setState({ dateOfIssue: value })
    }, (error: string) => console.log(error))

    //issuing state code
    results.textFieldValueByType(Enum.eVisualFieldType.FT_ISSUING_STATE_CODE, (value: string | undefined) => {
      this.setState({ issuingStateCode: value })
    }, (error: string) => console.log(error))

    //issuing state
    results.textFieldValueByType(Enum.eVisualFieldType.FT_ISSUING_STATE_NAME, (value: string | undefined) => {
      this.setState({ issuingState: value })
    }, (error: string) => console.log(error))

    //address state
    results.textFieldValueByType(Enum.eVisualFieldType.FT_ADDRESS_STATE, (value: string | undefined) => {
      this.setState({ addressState: value })
    }, (error: string) => console.log(error))

    //age
    results.textFieldValueByType(Enum.eVisualFieldType.FT_AGE, (value: string | undefined) => {
      this.setState({ age: value })
    }, (error: string) => console.log(error))

    //other person name
    results.textFieldValueByType(Enum.eVisualFieldType.FT_OTHERPERSON_NAME, (value: string | undefined) => {
      this.setState({ otherPersonName: value })
    }, (error: string) => console.log(error))

    //year since issue
    results.textFieldValueByType(Enum.eVisualFieldType.FT_YEARS_SINCE_ISSUE, (value: string | undefined) => {
      this.setState({ yearSinceIssue: value })
    }, (error: string) => console.log(error))

    //Age at issue
    results.textFieldValueByType(Enum.eVisualFieldType.FT_AGE_AT_ISSUE, (value: string | undefined) => {
      this.setState({ ageAtIssue: value })
    }, (error: string) => console.log(error))


    //displaying document image
    results.graphicFieldImageByType(Enum.eGraphicFieldType.GF_DOCUMENT_IMAGE, (value: string | undefined) => {
      if (value != null && value != "")
        this.setState({ docFront: { uri: "data:image/png;base64," + value } })
    }, (error: string) => console.log(error))

    //displaying portrait
    results.graphicFieldImageByType(Enum.eGraphicFieldType.GF_PORTRAIT, (value: string | undefined) => {
      if (value != null && value != "")
        this.setState({ portrait: { uri: "data:image/png;base64," + value } })
    }, (error: string) => console.log(error))

    //displaying signature
    results.graphicFieldImageByType(Enum.eGraphicFieldType.GF_SIGNATURE, (value: string | undefined) => {
      if (value != null && value != "")
        this.setState({ signature: { uri: "data:image/png;base64," + value } })
    }, (error: string) => console.log(error))

    //displaying hologram
    results.graphicFieldImageByType(Enum.eGraphicFieldType.GF_GHOST_PORTRAIT, (value: string | undefined) => {
      if (value != null && value != "")
        this.setState({ other: { uri: "data:image/png;base64," + value } })
    }, (error: string) => console.log(error))

    results.graphicFieldImageByTypeSource(Enum.eGraphicFieldType.GF_PORTRAIT, Enum.eRPRM_ResultType.RFID_RESULT_TYPE_RFID_IMAGE_DATA, (value: string | undefined) => {
      if (value != null && value != "")
        this.setState({ portrait: { uri: "data:image/png;base64," + value } })
    }, (error: string) => console.log(error))
  }

  customRFID() {
    this.showRfidUI()
    DocumentReader.readRFID(false, false, false, _ => { }, _ => { })
  }

  usualRFID() {
    isReadingRfid = true
    DocumentReader.startRFIDReader(false, false, false, _ => { }, _ => { })
  }

  handleResults(results: DocumentReaderResults) {
    console.log("Inside handle result");
    if (this.state.doRfid && !isReadingRfid && results != null && results.chipPage != 0) {
      // this.customRFID()
      this.usualRFID()
    } else {
      isReadingRfid = false
      this.displayResults(results)
    }
  }

  render() {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flexDirection: "row", padding: 5 }}>
          <View style={{ flexDirection: "column", alignItems: "center" }}>
            <Text style={styles.imageLabel}>Portrait</Text>
            <Image style={{ height: 150, width: 150 }} source={this.state.portrait} resizeMode="contain" />
          </View>
          <View style={{ flexDirection: "column", alignItems: "center", padding: 5 }}>
            <Text style={styles.imageLabel}>Document image</Text>
            <Image style={{ height: 150, width: 200 }} source={this.state.docFront} resizeMode="contain" />
          </View>
        </View>

        <View style={{ flexDirection: "row", padding: 1 }}>
          <View style={{ flexDirection: "column", alignItems: "center" }}>
            <Text style={styles.imageLabel}>Signature</Text>
            <Image style={{ height: 150, width: 150 }} source={this.state.signature} resizeMode="contain" />
          </View>
          <View style={{ flexDirection: "column", alignItems: "center", padding: 5 }}>
            <Text style={styles.imageLabel}>Hologram</Text>
            <Image style={{ height: 150, width: 200 }} source={this.state.other} resizeMode="contain" />
          </View>
        </View>

        {!this.state.isReadingRfidCustomUi && <View style={styles.container}>
          <View style={styles.container}>
            {this.state.documentNumber && (
              <View style={styles.row}>
                <Text style={styles.label}>Document Number:</Text>
                <Text style={styles.value}>{this.state.documentNumber}</Text>
              </View>
            )}
            {this.state.fullName && (
              <View style={styles.row}>
                <Text style={styles.label}>Full Name:</Text>
                <Text style={styles.value}>{this.state.fullName}</Text>
              </View>
            )}
            {this.state.dateOfBirth && (
              <View style={styles.row}>
                <Text style={styles.label}>Date of Birth:</Text>
                <Text style={styles.value}>{this.state.dateOfBirth}</Text>
              </View>
            )}
            {this.state.dateOfIssue && (
              <View style={styles.row}>
                <Text style={styles.label}>Date of Issue:</Text>
                <Text style={styles.value}>{this.state.dateOfIssue}</Text>
              </View>
            )}
            {this.state.issuingStateCode && (
              <View style={styles.row}>
                <Text style={styles.label}>Issuing State Code:</Text>
                <Text style={styles.value}>{this.state.issuingStateCode}</Text>
              </View>
            )}
            {this.state.issuingState && (
              <View style={styles.row}>
                <Text style={styles.label}>Issuing State:</Text>
                <Text style={styles.value}>{this.state.issuingState}</Text>
              </View>
            )}
            {this.state.addressState && (
              <View style={styles.row}>
                <Text style={styles.label}>Address State:</Text>
                <Text style={styles.value}>{this.state.addressState}</Text>
              </View>
            )}
            {this.state.age && (
              <View style={styles.row}>
                <Text style={styles.label}>Age:</Text>
                <Text style={styles.value}>{this.state.age}</Text>
              </View>
            )}
            {this.state.otherPersonName && (
              <View style={styles.row}>
                <Text style={styles.label}>Other Person Name:</Text>
                <Text style={styles.value}>{this.state.otherPersonName}</Text>
              </View>
            )}
            {this.state.yearSinceIssue && (
              <View style={styles.row}>
                <Text style={styles.label}>Year Since Issue:</Text>
                <Text style={styles.value}>{this.state.yearSinceIssue}</Text>
              </View>
            )}
            {this.state.ageAtIssue && (
              <View style={styles.row}>
                <Text style={styles.label}>Age at Issue:</Text>
                <Text style={styles.value}>{this.state.ageAtIssue}</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row' }}>
            <Button color="#4285F4" title="Scan document" onPress={() => this.scan()} />
            <Text style={{ padding: 5 }}></Text>
            <Button color="#4285F4" title="Scan image" onPress={() => this.recognize()} />
          </View>
        </View>}

        {(this.state.isReadingRfidCustomUi) && <View style={styles.container}>
          <Text style={{ paddingBottom: 30, fontSize: 23, color: this.state.rfidUIHeaderColor }}>{this.state.rfidUIHeader}</Text>
          <Text style={{ paddingBottom: 50, fontSize: 20 }}>{this.state.rfidDescription}</Text>
          <Progress.Bar style={{ marginBottom: 30 }} width={200} useNativeDriver={true} color="#4285F4" progress={this.state.rfidProgress} />
          <TouchableOpacity style={styles.cancelButton} onPress={() => { this.hideRfidUI() }}>
            <Text style={{ fontSize: 20 }}>X</Text>
          </TouchableOpacity>
        </View>}
      </SafeAreaView>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
    marginBottom: 12,
  },
  cancelButton: {
    position: 'absolute',
    bottom: 0,
    right: 20
  },
  imageLabel: {
    top: 1,
    right: 1,
    padding: 5
  },
  title: {
    left: 1,
    padding: 5,
    fontSize: 15
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Ensure space between label and value
    width: '90%', // Adjust width for better alignment
    marginBottom: 8, // Adjust spacing between rows
  },
  label: {
    fontSize: 15,
    fontWeight: 'bold', // For emphasis on labels
    width: '45%', // Ensure label takes up less space
  },
  value: {
    fontSize: 15,
    color: 'black', // Adjust color for the values
    width: '45%', // Ensure value takes up less space
    textAlign: 'right', // Align value to the right
  },
})