import typescript from 'rollup-plugin-typescript2';

export default {
    input: './src/run_simulation_worker.ts',

    output: {
        file: './js/worker-bundle.js',
        format: 'esm',
        sourcemap: 'inline'
    }, 

    plugins: [
        typescript()
    ]
}
