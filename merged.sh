#!/bin/bash

# 작업 디렉토리로 이동
CURRENT_DIR=$(pwd)
cd $CURRENT_DIR

# merge.md 파일 생성 (기존 파일이 있다면 내용을 덮어씁니다)
> merge.md


# src와 tests 폴더의 .ts 파일을 찾아서 처리
for folder in src prisma; do
    # 폴더 이름을 merge.md에 추가
    echo "# ${folder} 폴더" >> merge.md
    echo "" >> merge.md

    # 해당 폴더의 모든 .ts 파일을 찾아서 처리
    for file in $(find ./${folder} -name "*.ts" | sort); do
        # 파일 경로를 merge.md에 추가
        echo "\`\`\`ts" >> merge.md
        echo "/* ${file} */" >> merge.md

        # 파일 내용을 merge.md에 추가
        cat "$file" >> merge.md

        # 코드 블록 종료
        echo "\`\`\`" >> merge.md

        # 파일 사이에 빈 줄 추가
        echo "" >> merge.md
    done

      for file in $(find ./${folder} -name "*.prisma" | sort); do
        # 파일 경로를 merge.md에 추가
        echo "\`\`\`ts" >> merge.md
        echo "/* ${file} */" >> merge.md

        # 파일 내용을 merge.md에 추가
        cat "$file" >> merge.md

        # 코드 블록 종료
        echo "\`\`\`" >> merge.md

        # 파일 사이에 빈 줄 추가
        echo "" >> merge.md
    done

    # tsx 파일 섹션 시작
    echo "## tsx 파일" >> merge.md
    echo "" >> merge.md

    # 해당 폴더의 모든 .css 파일을 찾아서 처리
    for file in $(find ./${folder} -name "*.tsx" | sort); do
        # 파일 경로를 merge.md에 추가
        echo "\`\`\`tsx" >> merge.md
        echo "/* ${file} */" >> merge.md

        # 파일 내용을 merge.md에 추가
        cat "$file" >> merge.md

        # 코드 블록 종료
        echo "\`\`\`" >> merge.md

        # 파일 사이에 빈 줄 추가
        echo "" >> merge.md
    done
done

echo "HTML, src 폴더의 모든 .ts 및 css 파일이 경로와 함께 merge.md로 합쳐졌습니다."