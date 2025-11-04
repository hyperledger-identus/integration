import boxen from "boxen"

class Utils {
    printErrors(title: string, error: Error) {
        console.info(
            boxen(error.message + "\n" + error.stack, {
                title: title,
                titleAlignment: 'center',
                borderStyle: 'round',
                padding: 1,
                borderColor: 'redBright',
            })
        )
    }

    

}

export const utils = new Utils()