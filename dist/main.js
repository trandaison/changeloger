import childProcess from 'child_process';

const { exec } = childProcess;
function main() {
    console.log('Hello, world!');
    exec('git log', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing git log: ${error}`);
            return;
        }
        if (stderr) {
            console.error(`Error: ${stderr}`);
            return;
        }
        const gitLogOutput = stdout;
        console.log(gitLogOutput);
    });
}
main();
//# sourceMappingURL=main.js.map
