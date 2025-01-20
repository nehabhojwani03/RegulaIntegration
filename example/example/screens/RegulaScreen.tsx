import React from 'react'
import { SafeAreaView, ScrollView, StyleSheet, Text, View, NativeEventEmitter, Platform, TouchableOpacity, Image, Button, Alert } from 'react-native'
import DocumentReader, { Enum as DocEnum, DocumentReaderCompletion, DocumentReaderResults, DocumentReaderNotification, ScannerConfig, RecognizeConfig, DocReaderConfig, Functionality, RNRegulaDocumentReader } from '@regulaforensics/react-native-document-reader-api'
import FaceSDK, { Enum as FaceEnum, FaceCaptureResponse, LivenessResponse, MatchFacesResponse, MatchFacesRequest, MatchFacesImage, ComparedFacesSplit, InitConfig as FaceInitConfig, InitResponse, LivenessSkipStep, RNFaceApi, LivenessNotification } from '@regulaforensics/react-native-face-api'
import * as RNFS from 'react-native-fs'
import { launchImageLibrary } from 'react-native-image-picker'
import * as Progress from 'react-native-progress'

var image1 = new MatchFacesImage()
var image2 = new MatchFacesImage()
var isReadingRfid = false

interface IState {
    // Document SDK states
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
    docFront: any
    portrait: any
    signature: any
    other: any

    // Face SDK states
    img1: any
    img2: any
    similarity: string
    liveness: string

    // Flow control
    currentStep: 'document' | 'liveness' | 'matching' | 'complete'
    showResults: boolean
}

export default class RegulaScreen extends React.Component<{}, IState> {
    constructor(props: {}) {
        super(props)

        this.state = {
            // Document SDK states
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
            docFront: require('../images/id.png'),
            portrait: require('../images/portrait.png'),
            signature: require('../images/id.png'),
            other: require('../images/portrait.png'),

            // Face SDK states
            img1: require('../images/portrait.png'),
            img2: require('../images/portrait.png'),
            similarity: "null",
            liveness: "null",

            // Flow control
            currentStep: 'document',
            showResults: false,
        }

        this.initializeReaders()
    }

    initializeReaders() {
        // Document Reader initialization
        var docEventManager = new NativeEventEmitter(RNRegulaDocumentReader)
        docEventManager.addListener('completion', (e) => this.handleCompletion(DocumentReaderCompletion.fromJson(JSON.parse(e["msg"]))!))
        docEventManager.addListener('rfidOnProgressCompletion', e => this.updateRfidUI(DocumentReaderNotification.fromJson(JSON.parse(e["msg"]))!))
    
        // Face SDK initialization
        var faceEventManager = new NativeEventEmitter(RNFaceApi)
        faceEventManager.addListener('livenessNotificationEvent', data => {
            var notification = LivenessNotification.fromJson(JSON.parse(data))!
            console.log("LivenessStatus: " + notification.status)
        })
    
        // Initialize both SDKs
        var licPath = Platform.OS === 'ios' ? (RNFS.MainBundlePath + "/regula.license") : "regula.license"
        var readFile = Platform.OS === 'ios' ? RNFS.readFile : RNFS.readFileAssets
    
        const initializeFaceSDK = async (license: string) => {
            return new Promise((resolve, reject) => {
                // Try to initialize with null first to check status
                FaceSDK.initialize(null, async (firstResponse) => {
                    console.log("Initial Face SDK check response:", firstResponse)
                    const firstInitResponse = InitResponse.fromJson(JSON.parse(firstResponse))
    
                    if (firstInitResponse?.error?.code === 4) {  // Core is unavailable
                        // Try full initialization with license
                        var faceConfig = new FaceInitConfig()
                        faceConfig.license = license
    
                        // Add a small delay before second attempt
                        await new Promise(resolve => setTimeout(resolve, 1000))
    
                        FaceSDK.initialize(faceConfig, (secondResponse) => {
                            console.log("Face SDK full initialization response:", secondResponse)
                            const secondInitResponse = InitResponse.fromJson(JSON.parse(secondResponse))
                            
                            if (secondInitResponse?.success || secondInitResponse?.error?.message === "Core already running.") {
                                console.log("Face SDK initialized successfully")
                                resolve(true)
                            } else {
                                reject(new Error(`Face SDK initialization failed: ${secondInitResponse?.error?.message}`))
                            }
                        }, reject)
                    } else if (firstInitResponse?.success || firstInitResponse?.error?.message === "Core already running.") {
                        console.log("Face SDK already running")
                        resolve(true)
                    } else {
                        reject(new Error(`Unexpected Face SDK status: ${firstInitResponse?.error?.message}`))
                    }
                }, reject)
            })
        }
    
        const initializeDocReader = (license: string) => {
            return new Promise((resolve, reject) => {
                var docConfig = new DocReaderConfig()
                docConfig.license = license
                docConfig.delayedNNLoad = true
    
                DocumentReader.initializeReader(docConfig, (response) => {
                    console.log("Document Reader initialized successfully")
                    var functionality = new Functionality()
                    functionality.showCaptureButton = true
                    DocumentReader.setFunctionality(functionality, _ => { }, _ => { })
    
                    DocumentReader.getIsRFIDAvailableForUse((canRfid) => {
                        if (canRfid) {
                            this.setState({
                                canRfid: true,
                                rfidUIHeader: "Reading RFID",
                                rfidDescription: "Place your phone on top of the NFC tag",
                                rfidUIHeaderColor: "black",
                                canRfidTitle: ''
                            })
                        }
                        resolve(true)
                    }, reject)
                }, reject)
            })
        }
    
        // Main initialization flow
        readFile(licPath, 'base64')
            .then(async (license) => {
                try {
                    // Initialize Face SDK first
                    await initializeFaceSDK(license)
                    // Then initialize Document Reader
                    await initializeDocReader(license)
                    console.log("Both SDKs initialized successfully")
                } catch (error) {
                    console.error("Initialization error:", error)
                    // You might want to show an error message to the user
                    Alert.alert(
                        "Initialization Error",
                        "Failed to initialize services. Please try again.",
                        [{ text: "OK" }]
                    )
                }
            })
            .catch(error => {
                console.error("License reading error:", error)
                Alert.alert(
                    "License Error",
                    "Failed to read license file. Please check your configuration.",
                    [{ text: "OK" }]
                )
            })
    }

    // Document SDK methods
    scan() {
        this.clearResults()
        var config = new ScannerConfig()
        config.scenario = "FullProcess"
        DocumentReader.scan(config, _ => { }, e => console.log(e))
    }

    recognize() {
        launchImageLibrary({
            mediaType: 'photo',
            includeBase64: true,
            selectionLimit: 10
        }, r => {
            if (r.errorCode != null || r.didCancel) return

            this.clearResults()
            var response = r.assets
            var images: any = []

            for (var i = 0; i < response!.length; i++) {
                images.push(response![i].base64!)
            }

            var config = new RecognizeConfig()
            config.scenario = "FullProcess"
            config.images = images
            DocumentReader.recognize(config, _ => { }, e => console.log(e))
        })
    }

    handleCompletion(completion: DocumentReaderCompletion) {
        if (completion.action == DocEnum.DocReaderAction.COMPLETE) {
            this.displayResults(completion.results!)
            // Automatically start liveness check after document scan
            setTimeout(() => {
                this.liveness()
            }, 500) // Small delay to ensure results are processed
        }
    }

    displayResults(results: DocumentReaderResults) {
        if (results == null) return
        results.textFieldValueByType(DocEnum.eVisualFieldType.FT_DOCUMENT_NUMBER, (value: string | undefined) => {
            this.setState({ documentNumber: value })
        }, (error: string) => console.log(error))

        //Name
        results.textFieldValueByType(DocEnum.eVisualFieldType.FT_SURNAME_AND_GIVEN_NAMES, (value: string | undefined) => {
            this.setState({ fullName: value })
        }, (error: string) => console.log(error))

        //Date of birth
        results.textFieldValueByType(DocEnum.eVisualFieldType.FT_DATE_OF_BIRTH, (value: string | undefined) => {
            this.setState({ dateOfBirth: value })
        }, (error: string) => console.log(error))

        //date of issue
        results.textFieldValueByType(DocEnum.eVisualFieldType.FT_DATE_OF_ISSUE, (value: string | undefined) => {
            this.setState({ dateOfIssue: value })
        }, (error: string) => console.log(error))

        //issuing state code
        results.textFieldValueByType(DocEnum.eVisualFieldType.FT_ISSUING_STATE_CODE, (value: string | undefined) => {
            this.setState({ issuingStateCode: value })
        }, (error: string) => console.log(error))

        //issuing state
        results.textFieldValueByType(DocEnum.eVisualFieldType.FT_ISSUING_STATE_NAME, (value: string | undefined) => {
            this.setState({ issuingState: value })
        }, (error: string) => console.log(error))

        //address state
        results.textFieldValueByType(DocEnum.eVisualFieldType.FT_ADDRESS_STATE, (value: string | undefined) => {
            this.setState({ addressState: value })
        }, (error: string) => console.log(error))

        //age
        results.textFieldValueByType(DocEnum.eVisualFieldType.FT_AGE, (value: string | undefined) => {
            this.setState({ age: value })
        }, (error: string) => console.log(error))

        //other person name
        results.textFieldValueByType(DocEnum.eVisualFieldType.FT_OTHERPERSON_NAME, (value: string | undefined) => {
            this.setState({ otherPersonName: value })
        }, (error: string) => console.log(error))

        //year since issue
        results.textFieldValueByType(DocEnum.eVisualFieldType.FT_YEARS_SINCE_ISSUE, (value: string | undefined) => {
            this.setState({ yearSinceIssue: value })
        }, (error: string) => console.log(error))

        //Age at issue
        results.textFieldValueByType(DocEnum.eVisualFieldType.FT_AGE_AT_ISSUE, (value: string | undefined) => {
            this.setState({ ageAtIssue: value })
        }, (error: string) => console.log(error))

        results.graphicFieldImageByType(DocEnum.eGraphicFieldType.GF_DOCUMENT_IMAGE, (value: string | undefined) => {
            if (value != null && value != "")
                this.setState({ docFront: { uri: "data:image/png;base64," + value } })
        }, (error: string) => console.log(error))

        results.graphicFieldImageByType(DocEnum.eGraphicFieldType.GF_PORTRAIT, (value: string | undefined) => {
            if (value) {
                this.setState({ portrait: { uri: "data:image/png;base64," + value } })
                // Set document portrait for face matching
                image1 = new MatchFacesImage()
                image1.image = value
                image1.imageType = FaceEnum.ImageType.PRINTED
                this.setState({ img1: { uri: "data:image/png;base64," + value } })
            }
        }, (error: string) => console.log(error))
    }


    liveness() {
        FaceSDK.startLiveness({ skipStep: [LivenessSkipStep.ONBOARDING_STEP] }, (json: string) => {
            var response = LivenessResponse.fromJson(JSON.parse(json))!
            if (response.image != null) {
                image2 = new MatchFacesImage()
                image2.image = response.image
                image2.imageType = FaceEnum.ImageType.LIVE
                this.setState({
                    img2: { uri: "data:image/png;base64," + response.image },
                    liveness: response.liveness == FaceEnum.LivenessStatus.PASSED ? "passed" : "failed"
                })

                if (response.liveness == FaceEnum.LivenessStatus.PASSED) {
                    this.setState({ currentStep: 'matching' })
                    this.matchFaces()
                }
            }
        }, _e => { })
    }

    matchFaces() {
        if (image1.image == null || image2.image == null) return

        this.setState({ similarity: "Processing..." })
        var request = new MatchFacesRequest()
        request.images = [image1, image2]

        FaceSDK.matchFaces(request, null, (json: string) => {
            var response = MatchFacesResponse.fromJson(JSON.parse(json))
            FaceSDK.splitComparedFaces(response!.results!, 0.75, str => {
                var split = ComparedFacesSplit.fromJson(JSON.parse(str))!
                this.setState({
                    similarity: split.matchedFaces!.length > 0 ? ((split.matchedFaces![0].similarity! * 100).toFixed(2) + "%") : "error",
                    currentStep: 'complete',
                    showResults: true 
                })
            }, e => { this.setState({ similarity: e }) })
        }, e => { this.setState({ similarity: e }) })
    }

    // Common methods
    clearResults() {
        this.setState({
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
            docFront: require('../images/id.png'),
            portrait: require('../images/portrait.png'),
            signature: require('../images/id.png'),
            other: require('../images/portrait.png'),
            img1: require('../images/portrait.png'),
            img2: require('../images/portrait.png'),
            similarity: "null",
            liveness: "null",
            currentStep: 'document'
        })
        image1 = new MatchFacesImage()
        image2 = new MatchFacesImage()
    }

    // RFID related methods
    updateRfidUI(notification: DocumentReaderNotification) {
        if (notification.notificationCode === DocEnum.eRFID_NotificationCodes.RFID_NOTIFICATION_PCSC_READING_DATAGROUP)
            this.setState({ rfidDescription: "ERFIDDataFileType: " + notification.dataFileType })
        this.setState({ rfidUIHeader: "Reading RFID", rfidUIHeaderColor: "black" })
        if (notification.progress != null)
            this.setState({ rfidProgress: notification.progress / 100 })
    }

    render() {
        return (
            <SafeAreaView style={styles.container}>
                <ScrollView>
                    {/* Document Results Display */}
                     {this.state.showResults && (
                        <View style={styles.imagesContainer}>
                            <View style={styles.imageRow}>
                                <View style={styles.imageWrapper}>
                                    <Text style={styles.imageLabel}>Portrait</Text>
                                    <Image style={styles.image} source={this.state.portrait} resizeMode="contain" />
                                </View>
                                <View style={styles.imageWrapper}>
                                    <Text style={styles.imageLabel}>Document</Text>
                                    <Image style={styles.image} source={this.state.docFront} resizeMode="contain" />
                                </View>
                            </View>
                            <View style={styles.imageRow}>
                                <View style={styles.imageWrapper}>
                                    <Text style={styles.imageLabel}>Portrait</Text>
                                    <Image style={styles.image} source={this.state.img2} resizeMode="contain" />
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Control Buttons based on current step */}
                    <View style={styles.controlsContainer}>
                        {this.state.currentStep === 'document' && (
                            <View style={styles.buttonRow}>
                                <Button title="Scan Document" onPress={() => this.scan()} />
                                <Button title="Scan Image" onPress={() => this.recognize()} />
                            </View>
                        )}

                        {/* {this.state.currentStep === 'liveness' && (
                            <Button title="Start Liveness Check" onPress={() => this.liveness()} />
                        )} */}

                        {this.state.showResults && (
                            <View style={styles.resultsContainer}>
                                <Text style={styles.resultText}>Document Number: {this.state.documentNumber}</Text>
                                <Text style={styles.resultText}>Full Name: {this.state.fullName}</Text>
                                <Text style={styles.resultText}>Date of Birth: {this.state.dateOfBirth}</Text>
                                <Text style={styles.resultText}>Age: {this.state.age}</Text>
                                <Text style={styles.resultText}>Issuing State: {this.state.issuingState}</Text>
                                <Text style={styles.resultText}>Issuing State Code: {this.state.issuingStateCode}</Text>
                                <Text style={styles.resultText}>Address State: {this.state.addressState}</Text>
                                <Text style={styles.resultText}>Other Person Name: {this.state.otherPersonName}</Text>
                                <Text style={styles.resultText}>Year Since Issue: {this.state.yearSinceIssue}</Text>
                                <Text style={styles.resultText}>Age at issue: {this.state.ageAtIssue}</Text>
                                <Text style={styles.resultText}>Liveness: {this.state.liveness}</Text>
                                <Text style={styles.resultText}>Face Match: {this.state.similarity}</Text>
                                <Button
                                    title="Start New Verification"
                                    onPress={() => this.clearResults()}
                                />
                                {this.state.canRfid && (
                                    <Button
                                        title={`Read RFID ${this.state.canRfidTitle}`}
                                        onPress={() => this.setState({ isReadingRfidCustomUi: true })}
                                    />
                                )}
                            </View>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        )
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    imagesContainer: {
        padding: 20
    },
    imageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20
    },
    imageWrapper: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 5
    },
    imageLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8
    },
    image: {
        width: '100%',
        height: 150,
        borderRadius: 8,
        backgroundColor: '#f0f0f0'
    },
    controlsContainer: {
        padding: 20
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20
    },
    rfidContainer: {
        alignItems: 'center',
        padding: 20
    },
    rfidHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10
    },
    rfidDescription: {
        textAlign: 'center',
        marginBottom: 15
    },
    resultsContainer: {
        backgroundColor: '#f5f5f5',
        padding: 15,
        borderRadius: 8
    },
    resultText: {
        fontSize: 16,
        marginBottom: 8
    }
})